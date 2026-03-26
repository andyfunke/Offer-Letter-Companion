import React, { useState, useEffect } from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Calculator, CheckCircle2 } from 'lucide-react';

export function NormalizationPreview() {
  const { state, dispatch } = useOfferStore();
  const rawSalary = state.formData.annual_salary_input || 0;
  
  const [calc, setCalc] = useState({
    hourly: 0,
    roundedHourly: 0,
    recomputedAnnual: 0,
    biweekly: 0
  });

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

  const isConfirmed = state.normalizationConfirmed;

  return (
    <div className="mt-4 p-4 border border-primary/20 bg-primary/5 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-primary font-semibold">
        <Calculator className="w-5 h-5" />
        Compensation Normalization
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Target Annual</p>
          <p className="font-semibold">{formatCurrency(rawSalary)}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Hourly Base (÷2080)</p>
          <p className="font-semibold">{formatCurrency(calc.roundedHourly)}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border shadow-sm ring-2 ring-primary/20">
          <p className="text-muted-foreground text-xs mb-1">Actual Annual</p>
          <p className="font-semibold text-primary">{formatCurrency(calc.recomputedAnnual)}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border shadow-sm">
          <p className="text-muted-foreground text-xs mb-1">Bi-Weekly</p>
          <p className="font-semibold">{formatCurrency(calc.biweekly)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground max-w-[70%]">
          Salaries are normalized to a rounded hourly rate to ensure precise payroll processing. The actual annual salary will be {formatCurrency(calc.recomputedAnnual)}.
        </p>
        <Button 
          variant={isConfirmed ? "secondary" : "default"}
          onClick={() => dispatch({ type: 'CONFIRM_NORMALIZATION' })}
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
