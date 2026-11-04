// One-off address selection only. Accepted-trip tracking keeps its stricter rules.
export class RouteLocationError extends Error {
  constructor(readonly code: number) { super('ROUTE_LOCATION_FAILED'); }
}

export function routeLocationMessage(error: RouteLocationError) {
  if (error.code === 1) return 'Location access is blocked. Allow location access for this site in your browser and device settings, or search for your address.';
  if (error.code === 3) return 'Finding your location took too long. Try again or search for your address.';
  if (error.code === 0) return 'This browser doesn’t support location access. Search for your address.';
  return 'Your device couldn’t determine your location. Check device location services, or search for your address.';
}

export async function locateRouteOrigin(geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined,
  isCurrent: () => boolean = () => true): Promise<GeolocationPosition> {
  if (!geolocation) throw new RouteLocationError(0);
  const request = (options: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) =>
    geolocation.getCurrentPosition(resolve, error => reject(new RouteLocationError(error.code)), options));
  try {
    return await request({ enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  } catch (error) {
    if (!(error instanceof RouteLocationError) || error.code === 1 || !isCurrent()) throw error;
    // Desktop/indoor devices may have network positioning but no high-accuracy fix.
    // Never replace GPS with IP coordinates or retry a permission denial.
    return request({ enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 });
  }
}
