import React, { useState, useEffect } from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Calculator, CheckCircle2, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NormalizationPreview() {
  const { state, dispatch } = useOfferStore();
  const rawSalary = state.formData.annual_salary_input || 0;
  const isConfirmed = state.normalizationConfirmed;

  const [calc, setCalc] = useState({
    hourly: 0,
    roundedHourly: 0,
    recomputedAnnual: 0,
    biweekly: 0,
  });

  // Whether the user has clicked the Actual Annual card to "select" it
  const [selected, setSelected] = useState(false);

  // Reset selection if salary changes or confirmation is cleared
  useEffect(() => {
    if (!isConfirmed) setSelected(false);
  }, [rawSalary, isConfirmed]);

  useEffect(() => {
    if (rawSalary > 0) {
      const hourly = rawSalary / 2080;
      const roundedHourly = Math.ceil(hourly * 100) / 100;
      const recomputedAnnual = roundedHourly * 2080;
      const biweekly = recomputedAnnual / 26;
      setCalc({ hourly, roundedHourly, recomputedAnnual, biweekly });
    }
  }, [rawSalary]);

  if (!rawSalary) return null;

  function handleConfirm() {
    dispatch({
      type: 'CONFIRM_NORMALIZATION',
      normalizedAnnual: calc.recomputedAnnual,
      normalizedBiweekly: calc.biweekly,
    });
  }

  return (
    <div className="mt-4 p-4 border border-primary/20 bg-primary/5 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-primary font-semibold">
        <Calculator className="w-5 h-5" />
        Compensation Normalization
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {/* Target Annual — static info card */}
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Target Annual</p>
          <p className="font-semibold">{formatCurrency(rawSalary)}</p>
        </div>

        {/* Hourly Base — static info card */}
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Hourly Base (÷2080)</p>
          <p className="font-semibold">{formatCurrency(calc.roundedHourly)}</p>
        </div>

        {/* Actual Annual — clickable selection button */}
        <button
          type="button"
          onClick={() => !isConfirmed && setSelected(true)}
          disabled={isConfirmed}
          className={cn(
            "p-3 rounded-lg border shadow-sm text-left transition-all duration-150 focus:outline-none",
            isConfirmed
              ? "bg-green-50 border-green-300 cursor-default"
              : selected
                ? "bg-primary border-primary ring-2 ring-primary ring-offset-1 cursor-default"
                : "bg-white border-border hover:border-primary hover:ring-2 hover:ring-primary/30 cursor-pointer"
          )}
        >
          <p className={cn("text-xs mb-1 flex items-center gap-1", selected && !isConfirmed ? "text-white/80" : "text-muted-foreground")}>
            {!isConfirmed && !selected && <MousePointerClick className="w-3 h-3" />}
            {isConfirmed ? "Confirmed Annual" : "Actual Annual"}
          </p>
          <p className={cn("font-bold text-base", isConfirmed ? "text-green-700" : selected ? "text-white" : "text-primary")}>
            {formatCurrency(calc.recomputedAnnual)}
          </p>
        </button>

        {/* Bi-Weekly — static info card */}
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Bi-Weekly</p>
          <p className="font-semibold">{formatCurrency(calc.biweekly)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground max-w-[70%]">
          {isConfirmed
            ? <>Letter uses the normalized salary of <strong>{formatCurrency(calc.recomputedAnnual)}</strong> (rounded hourly × 2080).</>
            : selected
              ? <>Ready to confirm <strong>{formatCurrency(calc.recomputedAnnual)}</strong> as the offer salary — hit Confirm to update the letter.</>
              : <>Click <strong>Actual Annual</strong> to select the normalized amount, then confirm to update the letter.</>
          }
        </p>
        <Button
          variant={isConfirmed ? "secondary" : "default"}
          disabled={!selected && !isConfirmed}
          onClick={handleConfirm}
          className="shrink-0"
        >
          {isConfirmed ? (
            <><CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Confirmed</>
          ) : (
            "Confirm Amounts"
          )}
        </Button>
      </div>
    </div>
  );
}
