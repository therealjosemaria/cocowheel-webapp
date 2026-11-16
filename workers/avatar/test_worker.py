import copy
import unittest
import base64
import json
import subprocess
import tempfile
from unittest.mock import patch
from photo_visibility import score_landmarks
from worker import decide_photo, once


def standing():
    points = [[0.5, 0.2, 0, 1] for _ in range(33)]
    for side, x in [(0, 0.4), (1, 0.6)]:
        for index, y in [(11+side, 0.3), (13+side, 0.4), (15+side, 0.5), (23+side, 0.5), (25+side, 0.7), (27+side, 0.9), (29+side, 0.92), (31+side, 0.93)]:
            points[index][:2] = [x, y]
    for index in range(17,23): points[index][:2] = [0.4 if index%2 else 0.6, 0.5]
    return dict(score_landmarks(points), points=points, image_size=[400,800])


class WorkerTests(unittest.TestCase):
    def test_measures_only_check_process_and_cleans_spool(self):
        for result in [{'verdict': 'approved', 'reason': None}, {'verdict': 'rejected', 'reason': 'FEET'}]:
            with tempfile.TemporaryDirectory() as spool, patch('worker.request') as request, patch('worker.subprocess.run') as run, patch('worker.time.perf_counter', side_effect=[100, 100.432]):
                request.side_effect = [{'job': {'id': 'test', 'lease': 'test', 'photo': base64.b64encode(b'photo').decode()}}, {}]
                run.return_value.stdout = json.dumps(result)
                self.assertTrue(once({'spool': spool}))
                self.assertEqual(request.call_args.args[2], {'id': 'test', 'lease': 'test', **result, 'durationMs': 432})
                from pathlib import Path
                self.assertEqual(list(Path(spool).iterdir()), [])
    def test_runtime_failure_retries_without_completed_duration(self):
        with tempfile.TemporaryDirectory() as spool, patch('worker.request') as request, patch('worker.subprocess.run', side_effect=subprocess.TimeoutExpired('check', 60)):
            request.side_effect = [{'job': {'id': 'test', 'lease': 'test', 'photo': base64.b64encode(b'photo').decode()}}, {}]
            self.assertTrue(once({'spool': spool}))
            self.assertEqual(request.call_args.args[2]['verdict'], 'retry')
            self.assertIsNone(request.call_args.args[2]['durationMs'])
    def test_standing_is_admitted(self): self.assertEqual(decide_photo(standing(), 1)['verdict'], 'approved')
    def test_squat_is_not_admitted(self):
        result = standing()
        result['points'][25][:2] = [0.1,0.65]
        self.assertEqual(decide_photo(result,1)['reason'],'STANDING')
    def test_missing_person(self): self.assertEqual(decide_photo({},0)['reason'],'NO_PERSON')
    def test_zero_or_multiple_faces(self):
        for count in [0,2,3]: self.assertEqual(decide_photo(standing(),count)['reason'],'ONE_PERSON')
    def test_uncertain_regions_have_supported_retake_messages(self):
        for group, reason in [('head','HEAD'),('hands','HANDS'),('feet_toe_locations','FEET')]:
            result=copy.deepcopy(standing()); result['groups'][group]['pass']=False
            self.assertEqual(decide_photo(result,1)['reason'],reason)
    def test_cropped_feet(self):
        result=standing(); result['points'][32][1]=0.99
        self.assertEqual(decide_photo(result,1)['reason'],'FEET')
    def test_nonstanding_vertical_order(self):
        result=standing(); result['points'][25][1]=0.4
        self.assertEqual(decide_photo(result,1)['reason'],'STANDING')


if __name__=='__main__': unittest.main()
