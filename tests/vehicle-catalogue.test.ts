import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { checkedVehicle } from "../lib/vehicle";
import {
  VEHICLE_MODELS,
  VEHICLE_COLOURS,
  vehicleArtwork,
  validVehicleYear,
  vehicleYearOptions,
} from "../lib/vehicle-catalogue";

test("catalogue artwork requires four explicit, consistent selections", () => {
  const typed = {
    plate: "ABC123",
    make: "Toyota",
    model: "Corolla",
    colour: "White",
    year: "2018",
  };
  assert.equal(vehicleArtwork(checkedVehicle(typed)), undefined);
  assert.equal(
    vehicleArtwork(checkedVehicle({ ...typed, selection: {} })),
    undefined,
  );
  assert.equal(
    vehicleArtwork(
      checkedVehicle({
        ...typed,
        selection: { make: "Toyota", colour: "White" },
      }),
    ),
    undefined,
  );
  const selected = {
    ...typed,
    selection: {
      make: "Toyota",
      model: "toyota-corolla",
      colour: "White",
      year: "2018",
    },
  };
  assert.equal(
    vehicleArtwork(checkedVehicle(selected)),
    "/brand/vehicles/v1/toyota-corolla-white.webp",
  );
  for (const value of [
    { ...selected, make: "Ford" },
    { ...selected, colour: "Pink" },
    { ...selected, model: "Camry" },
    { ...selected, year: "2024" },
    {
      ...selected,
      selection: { ...selected.selection, model: "../../private" },
    },
    { ...selected, selection: { ...selected.selection, model: "ford-ranger" } },
    { ...selected, selection: { ...selected.selection, colour: "white" } },
    { ...selected, selection: { ...selected.selection, make: undefined } },
    {
      ...selected,
      selection: { ...selected.selection, url: "https://example.com/a.png" },
    },
    { ...selected, selection: null },
    { ...selected, selection: [] },
    { ...selected, selection: "toyota-corolla" },
  ]) {
    assert.throws(() => checkedVehicle(value), /INVALID_VEHICLE/);
    assert.equal(vehicleArtwork(value as typeof selected), undefined);
  }
});

test("all 20 models and six colours resolve to shipped artwork with no text guessing", () => {
  assert.equal(VEHICLE_MODELS.length, 20);
  assert.equal(new Set(VEHICLE_MODELS.map((item) => item.id)).size, 20);
  assert.equal(VEHICLE_COLOURS.length, 6);
  for (const item of VEHICLE_MODELS)
    for (const colour of VEHICLE_COLOURS)
      for (const year of vehicleYearOptions(item.id)) {
        const vehicle = checkedVehicle({
          plate: "123",
          make: item.make,
          model: item.model,
          colour,
          year,
          selection: { make: item.make, model: item.id, colour, year },
        });
        const artwork = vehicleArtwork(vehicle)!;
        assert.ok(existsSync(`public${artwork}`), artwork);
        assert.equal(
          vehicleArtwork({ ...vehicle, selection: undefined }),
          undefined,
        );
      }
});

test("year is never guessed and unsupported body years retain the generic icon", () => {
  const vehicle = {
    make: "Toyota",
    model: "Corolla",
    colour: "White",
    year: "2018",
    selection: {
      make: "Toyota",
      model: "toyota-corolla",
      colour: "White",
      year: "2018",
    },
  };
  for (const year of ["2024", "2026", "2001"]) {
    if (validVehicleYear(year))
      assert.equal(
        vehicleArtwork(
          checkedVehicle({
            ...vehicle,
            year,
            selection: { ...vehicle.selection, year: undefined },
          }),
        ),
        undefined,
      );
  }
  assert.equal(
    vehicleArtwork(
      checkedVehicle({
        ...vehicle,
        selection: { make: "Toyota", model: "toyota-corolla", colour: "White" },
      }),
    ),
    undefined,
  );
  assert.equal(
    vehicleArtwork(
      checkedVehicle({ ...vehicle, year: undefined, selection: undefined }),
    ),
    undefined,
  );
  for (const year of ["20", "20255", "0000", "<x>", "2099"]) {
    assert.equal(validVehicleYear(year), false);
    assert.throws(() => checkedVehicle({ year }), /INVALID_VEHICLE_YEAR/);
  }
  assert.throws(() => checkedVehicle({ year: 2025 }), /INVALID_VEHICLE_YEAR/);
  assert.equal(checkedVehicle({ year: " 2025 " }).year, "2025");
  assert.equal(checkedVehicle({ year: "1968" }).year, "1968");
});
