import { describe, it, expect } from 'vitest';
import { pricingSections, pricingSchema } from './publicPricing.mjs';

describe('public owner pricing catalog', () => {
  it('uses owner points over a stale mirrored job price for posting and extension', () => {
    const sections = pricingSections({jobs:{duration_packages:[{months:24,points:1300,price:299}]}});
    expect(sections.find(s => s.id === 'job-postings')?.plans[0].price).toBe(1300);
    expect(sections.find(s => s.id === 'extend-job')?.plans[0].price).toBe(1300);
  });
  it('reflects package additions, changes and removals on the next catalog read', () => {
    const get = (packages: unknown[]) => pricingSections({jobs:{duration_packages:packages}})[0].plans;
    expect(get([{months:1,points:160},{months:2,points:240}]).map(p => p.price)).toEqual([160,240]);
    expect(get([{months:2,points:280}]).map(p => p.price)).toEqual([280]);
  });
  it('excludes owner-disabled duration packages', () => {
    expect(pricingSections({jobs:{duration_packages:[{months:1,points:160},{months:2,points:240,is_active:false}]}})[0].plans.map(p => p.id)).toEqual(['1']);
  });
  it('does not invent prices when no owner rates are returned', () => {
    expect(pricingSections().flatMap(s => s.plans)).toEqual([]);
  });
  it('publishes all owner AI limits including zero image generation', () => {
    const ai = pricingSections({ai:[{id:'ai',name:'Saved',price_inr:499,messages_per_month:300,voice_playback_per_month:0,voice_input_per_month:0,image_analysis_per_month:0,ai_image_generation_per_month:0,ai_model_tier:'basic',features:[]}]}).find(s => s.id === 'ai');
    expect(ai?.plans[0].price).toBe(499);
    expect(ai?.plans[0].details).toContain('0 AI image generations / month');
  });
  it('exposes developer per-call fractional price without rounding it to rupees', () => {
    const section = pricingSections({settings:{api_subscription_price:'499',api_call_price:'0.11'}}).find(s => s.id === 'developers');
    expect(section?.plans.map(p => p.price)).toEqual([499,0.11]);
  });
  it('does not create duration charges when the owner disables them', () => {
    const section = pricingSections({interview:{points_per_interview:19,points_per_minute:16,minimum_points:0,enable_duration_pricing:false}}).find(s => s.id === 'interviews');
    expect(section?.plans.map(p => p.price)).toEqual([19]);
  });
  it('does not publish admin-only lifetime verification as a purchasable plan', () => {
    const section = pricingSections({verification:[{id:'life',name:'Lifetime',price_inr:499,validity_days:0}]}).find(s => s.id === 'verification');
    expect(section?.plans).toEqual([]);
  });
  it('structured offers use the same current public prices', () => {
    const schema = pricingSchema(pricingSections({settings:{api_call_price:'0.11'}}),'https://example.com/pricing');
    expect(schema.mainEntity.itemListElement.find((s: any) => s.name === 'Developer Pricing').itemListElement[0].price).toBe(0.11);
  });
});