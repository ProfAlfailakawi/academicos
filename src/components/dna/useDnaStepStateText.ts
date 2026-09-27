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
