import React, { useState } from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { UploadCloud, FileText, Loader2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function ResumeUpload() {
  const { dispatch } = useOfferStore();
  const [isUploading, setIsUploading] = useState(false);
  const [parseStep, setParseStep] = useState(0);

  const handleSimulateUpload = () => {
    setIsUploading(true);
    
    // Simulate multi-step parsing
    setTimeout(() => setParseStep(1), 800);
    setTimeout(() => setParseStep(2), 1600);
    setTimeout(() => {
      dispatch({
        type: 'SET_RESUME_DATA',
        payload: {
          fullName: 'Jane Smith',
          email: 'jane.smith@example.com',
          location: 'Vancouver, BC',
          isCanada: true,
          isWA: false
        }
      });
      setIsUploading(false);
    }, 2400);
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_STEP', payload: 'form' });
  };

  const resumeData = useOfferStore().state.resumeData;

  if (resumeData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg"
        >
          <Card className="border-primary/20 shadow-xl shadow-primary/5">
            <CardHeader className="bg-primary/5 border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-primary">
                <FileText className="w-5 h-5" />
                Resume Parsed Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Candidate Name</p>
                  <p className="text-lg font-semibold">{resumeData.fullName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-lg font-semibold">{resumeData.email}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Detected Location</p>
                  <p className="text-lg font-semibold flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-primary" /> {resumeData.location}
                  </p>
                </div>
              </div>

              {resumeData.isCanada && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                  <p className="font-semibold mb-1">Canadian Location Detected</p>
                  <p className="text-sm opacity-90">The candidate appears to be in Canada. Would you like to configure the immigration template?</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => dispatch({ type: 'RESET' })}>Start Over</Button>
                <Button onClick={handleContinue} className="bg-primary hover:bg-primary/90">
                  Continue to Letter Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">Start New Offer Letter</CardTitle>
          <p className="text-muted-foreground text-sm mt-2">Upload the candidate's resume to auto-fill details and configure initial letter constraints.</p>
        </CardHeader>
        <CardContent className="p-6">
          <button 
            onClick={handleSimulateUpload}
            disabled={isUploading}
            className="w-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-primary/30 rounded-xl bg-accent/5 hover:bg-accent/10 transition-colors group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <div className="flex flex-col items-center text-primary space-y-4">
                <Loader2 className="w-12 h-12 animate-spin" />
                <div className="text-sm font-medium">
                  {parseStep === 0 && "Uploading document..."}
                  {parseStep === 1 && "Extracting candidate details..."}
                  {parseStep === 2 && "Analyzing location constraints..."}
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8 text-primary" />
                </div>
                <p className="font-medium text-foreground mb-1">Click to browse or drag & drop</p>
                <p className="text-xs text-muted-foreground">PDF or DOCX up to 10MB</p>
              </>
            )}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
