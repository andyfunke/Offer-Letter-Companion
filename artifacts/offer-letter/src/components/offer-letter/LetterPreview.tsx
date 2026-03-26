import React from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export function LetterPreview() {
  const { state } = useOfferStore();
  const { formData, fieldStates } = state;

  const isActive = (field: string) => fieldStates[field] !== 'removed';
  
  const formattedDate = formData.letter_date ? format(new Date(formData.letter_date), 'MMMM d, yyyy') : '[Date]';
  const name = formData.candidate_full_name || '[Candidate Name]';
  const title = formData.job_title || '[Job Title]';
  const site = formData.site_name || '[Site Name]';
  const reportsTo = formData.reports_to_title || '[Manager Title]';
  const startDate = formData.start_date ? format(new Date(formData.start_date), 'MMMM d, yyyy') : '[Start Date]';
  
  return (
    <div className="bg-white rounded-sm shadow-xl border border-black/5 p-10 h-full overflow-y-auto letter-document">
      {/* Letterhead Header */}
      <div className="flex items-start justify-between border-b-2 border-primary pb-6 mb-8">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}images/kinross-logo-placeholder.png`} alt="Kinross Logo" className="w-12 h-12" />
          <div className="font-sans font-bold text-xl tracking-tight text-foreground">KINROSS</div>
        </div>
        <div className="text-right text-sm text-slate-500 font-sans">
          <p>Kinross Gold Corporation</p>
          <p>25 York Street, 17th Floor</p>
          <p>Toronto, ON M5J 2V5</p>
        </div>
      </div>

      {/* Meta */}
      <p className="mb-6">{formattedDate}</p>
      <div className="mb-8">
        <p>{name}</p>
        <p>{formData.mailing_or_email_destination || '[Candidate Address/Email]'}</p>
      </div>

      <p className="mb-6">Dear {name},</p>

      {/* Opening & Employment */}
      <p>
        We are pleased to offer you the position of <strong>{title}</strong> with Kinross Gold Corporation, operating through {formData.subsidiary_name || '[Subsidiary]'} at our {site} location. 
        In this role, you will report to the {reportsTo}. Your expected start date is <strong>{startDate}</strong>.
      </p>

      {/* Compensation */}
      <h3 className="font-bold text-lg mt-6 mb-2">Compensation</h3>
      <p>
        {formData.pay_basis === 'salaried' ? (
          <>Your annualized base salary will be <strong>{formatCurrency(formData.annual_salary_input || 0)}</strong>, which equates to a bi-weekly payment of {formatCurrency((formData.annual_salary_input || 0) / 26)}.</>
        ) : (
          <>Your starting hourly rate will be <strong>{formatCurrency(formData.hourly_rate_input || 0)}</strong>.</>
        )}
      </p>
      
      {isActive('stip_applicable') && formData.stip_target_percent && (
        <p>You will be eligible to participate in the Short-Term Incentive Plan (STIP) with a target payout of {formData.stip_target_percent}% of your base earnings.</p>
      )}

      {/* PTO */}
      <h3 className="font-bold text-lg mt-6 mb-2">Paid Time Off</h3>
      <p>
        You will be entitled to <strong>{formData.pto_confirmed_value || '[X]'} hours</strong> of Paid Time Off annually, subject to the standard accrual and rollover policies detailed in the Employee Handbook.
      </p>

      {/* Relocation */}
      {isActive('relocation_applicable') && (
        <>
          <h3 className="font-bold text-lg mt-6 mb-2">Relocation Assistance</h3>
          <p>To assist with your move from {formData.relocation_origin || '[Origin]'} to {formData.relocation_destination || '[Destination]'}, the Company will provide relocation assistance as outlined in the attached policy.</p>
          {isActive('relocation_repayment_agreement_required') && (
            <p className="text-sm italic mt-1">Note: A signed Relocation Repayment Agreement is required prior to distribution of funds.</p>
          )}
        </>
      )}

      {/* Contingencies */}
      <h3 className="font-bold text-lg mt-6 mb-2">Contingencies</h3>
      <p>This offer of employment is contingent upon the successful completion of:</p>
      <ul className="list-disc pl-8 mb-4">
        {formData.background_check_required && <li>A comprehensive background check</li>}
        {formData.drug_screen_required && <li>A pre-employment drug screening</li>}
        {formData.physical_required && <li>A fit-for-duty physical assessment</li>}
        {formData.work_authorization_clause_required && <li>Proof of legal right to work in {formData.governing_state || '[State]'}</li>}
      </ul>

      {/* Closing */}
      <p className="mt-8 mb-12">
        We are excited about the prospect of you joining the Kinross team. Please indicate your acceptance of this offer by signing below by {formData.acceptance_deadline ? format(new Date(formData.acceptance_deadline), 'MMMM d, yyyy') : '[Deadline]'}.
      </p>

      <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-slate-200">
        <div>
          <p className="mb-12">For Kinross Gold Corporation:</p>
          <div className="border-b border-black mb-2"></div>
          <p className="font-bold">{formData.company_representative_name || '[Company Rep]'}</p>
          <p className="text-sm text-slate-500">{formData.company_representative_title || '[Title]'}</p>
        </div>
        <div>
          <p className="mb-12">Accepted and Agreed:</p>
          <div className="border-b border-black mb-2"></div>
          <p className="font-bold">{name}</p>
          <p className="text-sm text-slate-500">Candidate</p>
        </div>
      </div>
    </div>
  );
}
