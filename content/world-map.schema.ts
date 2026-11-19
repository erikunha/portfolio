import { z } from 'zod';

const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;
const FULL_CIRCLE_DEGREES = 360;
const LAND_ROW_PATTERN = /^[01]+$/;

const LatitudeSchema = z.number().min(-LATITUDE_LIMIT).max(LATITUDE_LIMIT);
const LongitudeSchema = z.number().min(-LONGITUDE_LIMIT).max(LONGITUDE_LIMIT);

export const WorldMapSchema = z
  .object({
    grid: z.object({
      columns: z.number().int().positive(),
      rows: z.number().int().positive(),
      cellPx: z.number().positive(),
      degreesPerColumn: z.number().positive(),
      topLatitude: LatitudeSchema,
      bottomLatitude: LatitudeSchema,
    }),
    land: z.array(z.string().regex(LAND_ROW_PATTERN)),
    erikPin: z.object({
      place: z.string().min(1),
      code: z.string().min(1),
      lat: LatitudeSchema,
      lon: LongitudeSchema,
    }),
    knownZones: z.record(
      z.string().min(1),
      z.object({
        country: z.string().min(1),
        code: z.string().min(1),
        lat: LatitudeSchema,
        lon: LongitudeSchema,
      }),
    ),
  })
  .refine(({ grid, land }) => land.length === grid.rows, {
    message: 'land must have exactly grid.rows rows',
    path: ['land'],
  })
  .refine(({ grid, land }) => land.every((row) => row.length === grid.columns), {
    message: 'every land row must be grid.columns cells wide',
    path: ['land'],
  })
  .refine(({ grid }) => grid.columns * grid.degreesPerColumn === FULL_CIRCLE_DEGREES, {
    message: 'grid.columns times grid.degreesPerColumn must cover 360 degrees',
    path: ['grid', 'degreesPerColumn'],
  })
  .refine(
    ({ grid }) => grid.topLatitude - grid.bottomLatitude === grid.rows * grid.degreesPerColumn,
    {
      message: 'the latitude span must equal grid.rows times grid.degreesPerColumn',
      path: ['grid', 'bottomLatitude'],
    },
  );
export type WorldMap = z.infer<typeof WorldMapSchema>;
