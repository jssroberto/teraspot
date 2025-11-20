from yolo_processor import point_in_polygon


def test_point_inside_polygon():
    polygon = [(0, 0), (4, 0), (4, 4), (0, 4)]
    assert point_in_polygon((2, 2), polygon) is True


def test_point_outside_polygon():
    polygon = [(0, 0), (4, 0), (4, 4), (0, 4)]
    assert point_in_polygon((5, 5), polygon) is False


def test_point_on_edge_treated_inside():
    polygon = [(0, 0), (4, 0), (4, 4), (0, 4)]
    assert point_in_polygon((0, 2), polygon) is True
