"""Gumwheel-only Mac worker. Photos are private temporary files; never paid generation.

Uses the supplied MediaPipe 0.10.21 Full helper, adding conservative standing and
face-count gates. These are visibility/pose estimates, not identity verification.
"""
import argparse
import base64
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path
import tempfile
import time
import urllib.error
import urllib.request
from photo_visibility import check_photo, score_landmarks


def angle(a, b, c):
    u = (a[0]-b[0], a[1]-b[1]); v = (c[0]-b[0], c[1]-b[1])
    denominator = math.hypot(*u)*math.hypot(*v)
    if not denominator: return 0
    return math.degrees(math.acos(max(-1, min(1, (u[0]*v[0]+u[1]*v[1])/denominator))))


def decide_photo(result, face_count):
    points = result.get('points')
    if not points or len(points) != 33: return {'verdict': 'rejected', 'reason': 'NO_PERSON'}
    groups = result.get('groups', {})
    for group, reason in [('head', 'HEAD'), ('hands', 'HANDS'), ('feet_toe_locations', 'FEET')]:
        if not groups.get(group, {}).get('pass'): return {'verdict': 'rejected', 'reason': reason}
    if not result.get('visibility_proxy_pass'): return {'verdict': 'rejected', 'reason': 'BODY'}
    if face_count != 1: return {'verdict': 'rejected', 'reason': 'ONE_PERSON'}
    width, height = result['image_size']
    xy = [(p[0]*width, p[1]*height) for p in points]
    if min(p[1] for p in points[:11]) < 0.03: return {'verdict': 'rejected', 'reason': 'HEAD'}
    if max(p[1] for p in points[27:33]) > 0.985: return {'verdict': 'rejected', 'reason': 'FEET'}
    for shoulder, hip, knee, ankle in [(11, 23, 25, 27), (12, 24, 26, 28)]:
        if not xy[shoulder][1] < xy[hip][1] < xy[knee][1] < xy[ankle][1]:
            return {'verdict': 'rejected', 'reason': 'STANDING'}
        if angle(xy[hip], xy[knee], xy[ankle]) < 155 or angle(xy[shoulder], xy[hip], xy[knee]) < 150:
            return {'verdict': 'rejected', 'reason': 'STANDING'}
        dx, dy = xy[shoulder][0]-xy[hip][0], xy[hip][1]-xy[shoulder][1]
        if dy <= 0 or abs(dx)/dy > math.tan(math.radians(30)):
            return {'verdict': 'rejected', 'reason': 'STANDING'}
    return {'verdict': 'approved', 'reason': None}


def validate(path):
    import cv2
    import mediapipe as mp
    result = check_photo(path, threshold=0.8)
    bgr = cv2.imread(str(path))
    if bgr is None: raise ValueError('Cannot decode photo')
    # Retry one closer framing with the SAME threshold for distant subjects.
    # Map estimates back to the source for edge/standing checks; never rescue
    # landmarks estimated outside the original frame.
    points = result.get('points')
    if not result.get('visibility_proxy_pass') and points and all(0 <= p[0] <= 1 and 0 <= p[1] <= 1 for p in points):
        height, width = bgr.shape[:2]
        xs = [p[0] for p in points]; ys = [p[1] for p in points]
        padding = 0.12*(max(ys)-min(ys))
        x0, x1 = max(0, int((min(xs)-padding)*width)), min(width, int((max(xs)+padding)*width))
        y0, y1 = max(0, int((min(ys)-padding)*height)), min(height, int((max(ys)+padding)*height))
        if x1 > x0 and y1 > y0:
            with tempfile.TemporaryDirectory(prefix='visibility-', dir=Path(path).parent) as directory:
                framed = Path(directory)/'framed.jpg'
                if not cv2.imwrite(str(framed), bgr[y0:y1, x0:x1]): raise ValueError('Cannot prepare closer framing')
                closer = check_photo(framed, threshold=0.8)
            if closer.get('visibility_proxy_pass'):
                mapped = [[(p[0]*(x1-x0)+x0)/width, (p[1]*(y1-y0)+y0)/height, p[2], p[3]] for p in closer['points']]
                result = dict(score_landmarks(mapped, threshold=0.8), points=mapped, image_size=[width, height])
    with mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as faces:
        detections = faces.process(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).detections or []
        if not detections and result.get('visibility_proxy_pass'):
            height, width = bgr.shape[:2]
            head = result['points'][:11]
            xs, ys = [p[0]*width for p in head], [p[1]*height for p in head]
            padding = max(12, max(xs)-min(xs))
            x0, x1 = max(0, int(min(xs)-padding)), min(width, int(max(xs)+padding))
            y0, y1 = max(0, int(min(ys)-padding)), min(height, int(max(ys)+padding))
            if x1 > x0 and y1 > y0:
                detections = faces.process(cv2.cvtColor(bgr[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)).detections or []
    return decide_photo(result, len(detections))


def request(config, endpoint, payload):
    url = config['origin'].rstrip('/') + '/api/avatar-worker/' + endpoint
    if not url.startswith('https://') and not config.get('local_test'):
        raise ValueError('Worker requires HTTPS')
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST', headers={
        'Authorization': 'Bearer '+config['key'], 'Content-Type': 'application/json',
        'Accept': 'application/json', 'User-Agent': 'GUMWHEEL-Avatar-Worker/1.0'})
    # Never follow redirects carrying the service credential.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl): return None
    with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
        data = response.read(3_000_001)
        if len(data) > 3_000_000: raise ValueError('Oversized worker response')
        return json.loads(data)


def once(config):
    job = request(config, 'claim', {}).get('job')
    if not job: return False
    # TemporaryDirectory is owner-only; neither filenames nor photos enter logs.
    with tempfile.TemporaryDirectory(prefix='photo-', dir=config['spool']) as directory:
        path = Path(directory)/'photo.jpg'
        duration_ms = None
        try:
            data = base64.b64decode(job['photo'], validate=True)
            if len(data) > 2_000_000: raise ValueError('Oversized photo')
            path.write_bytes(data); os.chmod(path, 0o600)
            started = time.perf_counter()
            checked = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--check', str(path)],
                                     capture_output=True, text=True, check=True, timeout=60)
            duration_ms = round((time.perf_counter() - started) * 1000)
            result = json.loads(checked.stdout)
        except Exception:
            result = {'verdict': 'retry', 'reason': None}
        request(config, 'result', {'id':job['id'], 'lease':job['lease'], **result, 'durationMs': duration_ms})
        print('Photo check completed: '+result['verdict'], flush=True)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path)
    parser.add_argument('--check', type=Path)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    if args.check:
        print(json.dumps(validate(args.check))); return
    if not args.config: parser.error('--config is required')
    config = json.loads(args.config.read_text())
    if len(config.get('key', '')) < 43: raise ValueError('Invalid worker credential')
    spool = Path(config['spool'])
    spool.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(spool, 0o700)
    # Launchd runs one instance. Remove only this worker's abandoned private files.
    for old in spool.glob('photo-*'):
        if old.is_dir() and not old.is_symlink(): shutil.rmtree(old)
    while True:
        try:
            busy = once(config)
            if args.once: return
            time.sleep(2 if busy else 30)
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
            if args.once: raise
            print('Photo service unavailable; checking again shortly.', flush=True)
            time.sleep(30)


if __name__ == '__main__': main()
