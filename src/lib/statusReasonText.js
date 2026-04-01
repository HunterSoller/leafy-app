/**
 * Secondary copy for care panel & trust — keeps main status logic in hydrationModel.
 */

import {
  isOutdoorContainerPlant,
  isOutdoorInGroundOrBed,
  pickHeatTempF,
} from './hydrationModel'

/** Subtle chip: when it helps trust, without duplicating scene badges. */
export function getCareBasisChip(plant) {
  if (!plant) return null
  if (plant.aiGenerated && !plant.aiCorrectedByUser) {
    if (
      plant.sceneType === 'garden_area' ||
      plant.sceneType === 'multiple_plants'
    ) {
      return null
    }
    if (plant.matchKind === 'area' || plant.careMatchQuality === 'area') {
      return 'General outdoor care'
    }
    return 'Identified from photo'
  }
  return null
}

/** Expanded care: how this outdoor plant is set up. */
export function getOutdoorSetupLine(plant) {
  if (!plant || plant.location !== 'outdoor') return null
  if (plant.sceneType === 'garden_area' || plant.matchKind === 'area') {
    return 'Setup: Garden area'
  }
  if (plant.sceneType === 'multiple_plants') {
    return 'Setup: Mixed planting'
  }
  if (isOutdoorContainerPlant(plant)) {
    return 'Setup: Outdoor container'
  }
  if (isOutdoorInGroundOrBed(plant)) {
    return 'Setup: In-ground bed'
  }
  return 'Setup: Outdoor'
}

/**
 * Plain-language weather effect for expanded care (outdoor only).
 * No mm / units.
 */
export function getWeatherEffectCareLine(plant, weather, balanceMeta) {
  if (!plant || plant.location !== 'outdoor' || !weather) return null
  if (weather.adjustmentsActive !== true) {
    return null
  }

  if (balanceMeta?.rainJustCredited) {
    return 'Weather effect: Rain gave the soil a boost'
  }

  const mm = weather.mmCombined48h ?? 0
  const tempF = pickHeatTempF(weather)

  if (mm >= 12) {
    return 'Weather effect: Rain helped recently'
  }
  if (mm < 3 && tempF > 88) {
    return 'Weather effect: Dry heat is pulling moisture fast'
  }
  if (tempF > 92) {
    return 'Weather effect: Hot weather is drying this faster'
  }
  if (tempF > 84) {
    return 'Weather effect: Warm spell — soil may dry sooner'
  }
  if (mm < 2) {
    return 'Weather effect: No recent rain'
  }
  return 'Weather effect: Light rain — mostly time-based drying'
}

