import { BRAND_CONFIG } from '../../_shared/brandConfig.ts';

// Vision Tools for Screenshot Analysis and Scam Detection

export async function analyzeScreenshot(supabase: any, imageData: string, user_id: string) {
  // Scam detection patterns
  const scamIndicators = {
    highRisk: [
      'upfront payment', 'registration fee', 'training fee', 'deposit required',
      'pay before interview', 'processing charge', 'security deposit',
      'guaranteed income', 'earn lakhs', 'Workly India guaranteed',
      'no experience needed - high salary', 'bitcoin', 'cryptocurrency',
      'पहले पैसे दो', 'रजिस्ट्रेशन फीस', 'गारंटीड कमाई'
    ],
    mediumRisk: [
      'limited time offer', 'urgent hiring', 'immediate joining',
      'no interview required', 'email only', 'whatsapp only',
      'तुरंत भर्ती', 'कोई इंटरव्यू नहीं'
    ],
    legitimate: [
      BRAND_CONFIG.name.toLowerCase().replace(/\s+/g, ''), BRAND_CONFIG.domain, 'verified company', 'free to apply',
      'no registration fee', 'zero fees for job seekers'
    ]
  };

  const analysis = {
    riskLevel: 'unknown',
    scamIndicators: [] as string[],
    legitimateIndicators: [] as string[],
    recommendation: '',
    detectedText: imageData.toLowerCase()
  };

  // Check for scam patterns
  for (const indicator of scamIndicators.highRisk) {
    if (analysis.detectedText.includes(indicator.toLowerCase())) {
      analysis.scamIndicators.push(indicator);
      analysis.riskLevel = 'high';
    }
  }

  if (analysis.riskLevel !== 'high') {
    for (const indicator of scamIndicators.mediumRisk) {
      if (analysis.detectedText.includes(indicator.toLowerCase())) {
        analysis.scamIndicators.push(indicator);
        analysis.riskLevel = 'medium';
      }
    }
  }

  // Check for legitimate indicators
  for (const indicator of scamIndicators.legitimate) {
    if (analysis.detectedText.includes(indicator.toLowerCase())) {
      analysis.legitimateIndicators.push(indicator);
    }
  }

  // Set recommendation based on risk level
  if (analysis.riskLevel === 'high') {
    analysis.recommendation = `🚨 HIGH RISK - LIKELY SCAM! This appears to be a fraudulent job posting. Do NOT pay any money or share sensitive information. ${BRAND_CONFIG.name} jobs are 100% free for job seekers. Report this immediately.`;
  } else if (analysis.riskLevel === 'medium') {
    analysis.recommendation = `⚠️ MEDIUM RISK - Be cautious! This posting shows some warning signs. Verify the company on ${BRAND_CONFIG.name} platform before proceeding. Never pay any fees.`;
  } else if (analysis.legitimateIndicators.length > 0) {
    analysis.recommendation = `✅ APPEARS LEGITIMATE - This seems to be from ${BRAND_CONFIG.name} or follows our zero-fee policy. Still verify company details before applying.`;
  } else {
    analysis.recommendation = `❓ UNKNOWN - Cannot determine legitimacy. Always verify jobs through ${BRAND_CONFIG.name} platform. Remember: genuine jobs never ask for money.`;
  }

  // Log the analysis for admin review
  await supabase.from('scam_detection_logs').insert({
    user_id,
    analysis_result: analysis,
    detected_at: new Date().toISOString()
  });

  return {
    success: true,
    analysis,
    protectionTips: [
      `✅ Use only ${BRAND_CONFIG.name} verified jobs`,
      '❌ NEVER pay registration/training fees',
      '✅ Verify company on our platform',
      '❌ Don\'t share bank details in interview',
      '✅ Report suspicious jobs immediately'
    ]
  };
}

export async function detectScamPatterns(text: string) {
  const lowerText = text.toLowerCase();
  const patterns = {
    paymentDemands: /pay|payment|fee|charge|deposit|rupees|₹|rs\.|amount/gi,
    urgencyWords: /urgent|immediately|today|right now|limited|last chance/gi,
    guarantees: /guaranteed|100%|assured|confirm|certain/gi,
    suspiciousContact: /whatsapp only|email only|telegram|personal email/gi
  };

  const matches = {
    paymentDemands: (lowerText.match(patterns.paymentDemands) || []).length,
    urgencyWords: (lowerText.match(patterns.urgencyWords) || []).length,
    guarantees: (lowerText.match(patterns.guarantees) || []).length,
    suspiciousContact: (lowerText.match(patterns.suspiciousContact) || []).length
  };

  const totalRiskScore = 
    matches.paymentDemands * 3 + 
    matches.urgencyWords * 2 + 
    matches.guarantees * 2 + 
    matches.suspiciousContact * 3;

  return {
    isHighRisk: totalRiskScore >= 8,
    isMediumRisk: totalRiskScore >= 4 && totalRiskScore < 8,
    riskScore: totalRiskScore,
    matches
  };
}
