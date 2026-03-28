import React, { ReactNode } from 'react';
import { useOfferStore, FieldState } from '@/hooks/use-offer-store';
import { X, RotateCcw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface FieldWrapperProps {
  id: string;
  label: string;
  children: ReactNode;
  optional?: boolean;
  helpText?: string;
}

export function FieldWrapper({ id, label, children, optional = false, helpText }: FieldWrapperProps) {
  const { state, dispatch } = useOfferStore();
  const fieldState: FieldState = state.fieldStates[id] || 'active';
  
  const isRemoved = fieldState === 'removed';
  const isInherited = fieldState === 'inherited';

  const handleToggleState = () => {
    dispatch({ 
      type: 'SET_FIELD_STATE', 
      field: id, 
      state: isRemoved ? 'active' : 'removed' 
    });
  };

  return (
    <div
      id={`field-${id}`}
      className={cn(
        "group relative flex flex-col space-y-2 p-4 rounded-xl border transition-all duration-300",
        isRemoved ? "bg-muted/50 border-dashed border-border" : 
        isInherited ? "bg-accent/10 border-primary/20 shadow-sm" : 
        "bg-card border-border shadow-sm hover:border-primary/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label htmlFor={id} className={cn("text-sm font-semibold", isRemoved ? "text-muted-foreground line-through" : "text-foreground")}>
              {label}
              {!optional && !isRemoved && (
                <span className="ml-0.5 text-red-500 select-none" aria-label="required">*</span>
              )}
            </label>
            {isInherited && !isRemoved && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-0 h-5 text-[10px]">
                Inherited from Template
              </Badge>
            )}
            {isRemoved && (
              <Badge variant="outline" className="text-muted-foreground h-5 text-[10px] border-dashed">
                Not Applicable
              </Badge>
            )}
          </div>
          {helpText && !isRemoved && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" /> {helpText}
            </p>
          )}
        </div>
        
        {optional && (
          <button
            type="button"
            onClick={handleToggleState}
            className={cn(
              "p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100",
              isRemoved ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            )}
            title={isRemoved ? "Add back to letter" : "Remove from letter"}
          >
            {isRemoved ? <RotateCcw className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {!isRemoved && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="pt-2"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
