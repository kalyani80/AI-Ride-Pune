import math


def hex_cell(lat, lng, size_km=3):
    x = lng * 111.32 * math.cos(math.radians(lat))
    y = lat * 110.57
    q = (math.sqrt(3) / 3 * x - y / 3) / size_km
    r = (2 / 3 * y) / size_km

    x_cube, z_cube = q, r
    y_cube = -x_cube - z_cube

    rx, ry, rz = round(x_cube), round(y_cube), round(z_cube)
    dx, dy, dz = abs(rx - x_cube), abs(ry - y_cube), abs(rz - z_cube)

    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        ry = -rx - rz
    else:
        rz = -rx - ry

    return int(rx), int(rz)


def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))
