import { useI18n } from "../../lib/i18n";
import type { DnaStepState } from "./DnaKit";

/** Localised screen-reader words for DnaStepper states (the kit defaults are Arabic). */
export function useDnaStepStateText(): Record<DnaStepState, string> {
  const { t } = useI18n();
  return {
    done: t("ui.stepDone"),
    current: t("ui.stepCurrent"),
    pending: t("ui.stepPending"),
    returned: t("ui.stepReturned"),
    blocked: t("ui.stepBlocked"),
  };
}

/**
 * Screen-reader words for flows whose stations are only an estimate (no server progress feed):
 * a station that has "passed" is never announced as completed.
 */
export function useDnaEstimatedStepStateText(): Record<DnaStepState, string> {
  const { t } = useI18n();
  return {
    done: t("ui.stepEstDone"),
    current: t("ui.stepEstCurrent"),
    pending: t("ui.stepEstPending"),
    returned: t("ui.stepReturned"),
    blocked: t("ui.stepBlocked"),
  };
}
