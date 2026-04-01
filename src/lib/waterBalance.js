/**
 * Compatibility re-exports — core implementation: ./hydrationModel.js
 */

export * from './hydrationModel'

export {
  estimateLegacyHydration as estimateLegacyWaterLevel,
  computeSyncedHydration as computeSyncedWaterBalance,
  hydrationNeedsPersist as waterBalanceNeedsPersist,
  getSmartHydrationStatus as getSmartStatusFromWaterLevel,
  initialHydrationForNewPlant as initialWaterLevelForNewPlant,
  hydrationBoostFromRainDelta as applyRainIncrement,
} from './hydrationModel'
