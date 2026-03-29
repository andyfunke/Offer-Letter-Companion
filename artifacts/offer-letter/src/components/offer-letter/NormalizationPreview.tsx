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

  const [selected, setSelected] = useState(false);

  // Reset selection whenever salary changes or confirmation is cleared
  useEffect(() => {
    if (!isConfirmed) setSelected(false);
  }, [rawSalary, isConfirmed]);

  // Compute inline — no useState/useEffect so handleConfirm always sees current values
  const hourly = rawSalary > 0 ? rawSalary / 2080 : 0;
  const roundedHourly = rawSalary > 0 ? Math.ceil(hourly * 100) / 100 : 0;
  const recomputedAnnual = roundedHourly * 2080;
  const biweekly = recomputedAnnual / 26;

  if (!rawSalary) return null;

  function handleConfirm() {
    dispatch({
      type: 'CONFIRM_NORMALIZATION',
      normalizedAnnual: recomputedAnnual,
      normalizedBiweekly: biweekly,
    });
  }

  return (
    <div className="mt-4 p-4 border border-primary/20 bg-primary/5 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-primary font-semibold">
        <Calculator className="w-5 h-5" />
        Compensation Normalization
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {/* Target Annual */}
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Target Annual</p>
          <p className="font-semibold">{formatCurrency(rawSalary)}</p>
        </div>

        {/* Hourly Base */}
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Hourly Base (÷2080)</p>
          <p className="font-semibold">{formatCurrency(roundedHourly)}</p>
        </div>

        {/* Actual Annual — clickable */}
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
            {formatCurrency(recomputedAnnual)}
          </p>
        </button>

        {/* Bi-Weekly */}
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Bi-Weekly</p>
          <p className="font-semibold">{formatCurrency(biweekly)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground max-w-[70%]">
          {isConfirmed
            ? <>Letter uses the normalized salary of <strong>{formatCurrency(recomputedAnnual)}</strong> (rounded hourly × 2080).</>
            : selected
              ? <>Ready to confirm <strong>{formatCurrency(recomputedAnnual)}</strong> as the offer salary — hit Confirm to update the letter.</>
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
