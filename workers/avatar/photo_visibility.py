"""Standalone photo visibility proxy derived from the three-photo probe.

No Mirror PT imports. This is not a standing classifier or an avatar-ready
certificate. Importing this module performs no inference or file writes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import time

GROUPS = {
    'head': tuple(range(11)), 'shoulders': (11, 12),
    'upper_arms': (11, 12, 13, 14), 'elbows': (13, 14),
    'forearms': (13, 14, 15, 16), 'hands': tuple(range(15, 23)),
    'hips_waist_proxy': (23, 24), 'chest_core_proxy': (11, 12, 23, 24),
    'knees': (25, 26), 'ankles': (27, 28),
    'feet_toe_locations': (27, 28, 29, 30, 31, 32),
}


def score_landmarks(points, threshold=0.8):
    """Score normalized [x,y,z,visibility] points; preserve uncertainty.

    Coordinates are MediaPipe's normalized image coordinates, not pixels.
    Chest/waist and toe positions are proxies, never proof of direct visibility.
    """
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError('Visibility threshold must be finite and within [0,1]')
    valid = isinstance(points, (list, tuple)) and len(points) == 33
    if valid:
        valid = all(isinstance(p, (list, tuple)) and len(p) == 4 and
                    all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in p)
                    and 0 <= p[3] <= 1 for p in points)
    if not valid:
        return {'visibility_proxy_pass': False, 'reason': 'missing_or_invalid_landmarks', 'groups': {},
                'standing_gate': 'not_implemented', 'actual_bare_toes_verified': False}
    groups = {}
    for name, ids in GROUPS.items():
        inside = all(0 <= points[i][0] <= 1 and 0 <= points[i][1] <= 1 for i in ids)
        visibility = min(points[i][3] for i in ids)
        groups[name] = {'minimum_visibility': visibility, 'all_in_frame': inside,
                        'pass': inside and visibility >= threshold}
    return {'visibility_proxy_pass': all(g['pass'] for g in groups.values()),
            'reason': 'all_proxy_checks_pass' if all(g['pass'] for g in groups.values()) else 'required_region_not_supported',
            'threshold': threshold, 'groups': groups,
            'standing_gate': 'not_implemented', 'actual_bare_toes_verified': False}


def check_photo(path, threshold=0.8):
    """One fresh MediaPipe static-image call; runtime dependencies loaded lazily."""
    import cv2
    import mediapipe as mp
    if mp.__version__ != '0.10.21':
        raise RuntimeError('This handoff was tested with mediapipe==0.10.21')
    path = Path(path).expanduser().resolve()
    bgr = cv2.imread(str(path))
    if bgr is None:
        raise ValueError('Cannot decode photo: ' + str(path))
    started = time.perf_counter()
    with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1,
            smooth_landmarks=False, enable_segmentation=False,
            min_detection_confidence=0.5) as pose:
        result = pose.process(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    points = None if result.pose_landmarks is None else [
        [p.x, p.y, p.z, p.visibility] for p in result.pose_landmarks.landmark]
    return dict(score_landmarks(points, threshold), model='MediaPipe Pose Full',
                mediapipe_version=mp.__version__, image=str(path),
                image_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                image_size=[bgr.shape[1], bgr.shape[0]], points=points,
                load_process_close_seconds=time.perf_counter()-started)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('photo', type=Path)
    parser.add_argument('--output', type=Path, required=True, help='New JSON file; refuses overwrite')
    parser.add_argument('--threshold', type=float, default=0.8)
    args = parser.parse_args()
    # Fail before inference for an existing target; exclusive creation also
    # protects against a target created while inference is running.
    target = args.output.expanduser()
    if target.exists():
        parser.error('Output already exists: ' + str(target))
    result = check_photo(args.photo, args.threshold)
    with target.open('x') as output:
        json.dump(result, output, indent=2, allow_nan=False)
        output.write('\n')


if __name__ == '__main__':
    main()
