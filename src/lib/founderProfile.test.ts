import { describe, expect, it } from 'bun:test';
import { founderSchema } from './founderProfile.mjs';

describe('founder public identity', () => {
  it('links founder and organization to the same canonical domain', () => {
    const person = founderSchema('https://worklyindia.devs.surf/');
    expect(person.jobTitle).toBe('Founder & CEO');
    expect(person.worksFor['@id']).toBe('https://worklyindia.devs.surf/#organization');
    expect(person.url).toBe('https://worklyindia.devs.surf/about-us#founder');
  });
  it('uses the owner-updated Cloudflare image unchanged', () => {
    expect(founderSchema('https://worklyindia.devs.surf', 'https://media.example.org/new-photo.png').image).toBe('https://media.example.org/new-photo.png');
  });
  it('resolves the supplied photo when no replacement exists', () => {
    expect(founderSchema('https://worklyindia.devs.surf', '').image).toBe('https://worklyindia.devs.surf/founder-ceo.jpg');
  });
});