import copy
import unittest
from photo_visibility import score_landmarks
from worker import decide_photo


def standing():
    points = [[0.5, 0.2, 0, 1] for _ in range(33)]
    for side, x in [(0, 0.4), (1, 0.6)]:
        for index, y in [(11+side, 0.3), (13+side, 0.4), (15+side, 0.5), (23+side, 0.5), (25+side, 0.7), (27+side, 0.9), (29+side, 0.92), (31+side, 0.93)]:
            points[index][:2] = [x, y]
    for index in range(17,23): points[index][:2] = [0.4 if index%2 else 0.6, 0.5]
    return dict(score_landmarks(points), points=points, image_size=[400,800])


class WorkerTests(unittest.TestCase):
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
