import assert from 'node:assert/strict';
import test from 'node:test';
import { locateRouteOrigin, RouteLocationError, routeLocationMessage } from '../lib/route-location';

const position = { coords: { latitude: -33.88, longitude: 151.2 } } as GeolocationPosition;
function fake(codes: number[]) {
  const calls: PositionOptions[] = [];
  return { calls, getCurrentPosition(success: PositionCallback, failure?: PositionErrorCallback | null, options?: PositionOptions) {
    calls.push(options!);
    const code = codes.shift();
    if (code) failure!({ code } as GeolocationPositionError);
    else success(position);
  } };
}
test('one-off route lookup preserves fresh high-accuracy success', async () => {
  const gps = fake([]);
  assert.equal(await locateRouteOrigin(gps), position);
  assert.deepEqual(gps.calls, [{ enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }]);
});
test('unavailable and timed-out GPS can use one bounded standard-accuracy fallback', async () => {
  for (const code of [2, 3]) {
    const gps = fake([code]);
    assert.equal(await locateRouteOrigin(gps), position);
    assert.deepEqual(gps.calls[1], { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 });
  }
});
test('denial, unavailable API and abandoned selections do not retry', async () => {
  const denied = fake([1]);
  await assert.rejects(locateRouteOrigin(denied), (e: unknown) => e instanceof RouteLocationError && e.code === 1);
  assert.equal(denied.calls.length, 1);
  await assert.rejects(locateRouteOrigin(undefined), (e: unknown) => e instanceof RouteLocationError && e.code === 0);
  const abandoned = fake([3]);
  await assert.rejects(locateRouteOrigin(abandoned, () => false));
  assert.equal(abandoned.calls.length, 1);
});
test('final GPS failure retains its specific reason and every message gives a next step', async () => {
  const gps = fake([3, 2]);
  await assert.rejects(locateRouteOrigin(gps), (e: unknown) => e instanceof RouteLocationError && e.code === 2);
  assert.equal(gps.calls.length, 2);
  for (const code of [0, 1, 2, 3]) assert.match(routeLocationMessage(new RouteLocationError(code)), /[Ss]earch for your address/);
});
