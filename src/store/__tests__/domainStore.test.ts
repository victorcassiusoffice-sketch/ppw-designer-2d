/**
 * domainStore — active-domain resolution + persistence (DESIGNER-EXPANSION P4).
 *
 * Proves the boot behaviour P1's gate described but never wired:
 *   ?domain=car → car · ?domain=junk → wellness · no param → wellness.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveDomainParam,
  readDomainFromSearch,
  initDomainFromLocation,
  useDomainStore,
} from '../domainStore';

beforeEach(() => {
  localStorage.clear();
  useDomainStore.getState().resetDomain();
});

describe('resolveDomainParam', () => {
  it('maps a valid domain id through', () => {
    expect(resolveDomainParam('car')).toBe('car');
    expect(resolveDomainParam('airplane')).toBe('airplane');
    expect(resolveDomainParam('wellness-room')).toBe('wellness-room');
  });

  it('falls back to wellness-room for junk / missing / proto-pollution', () => {
    expect(resolveDomainParam('junk')).toBe('wellness-room');
    expect(resolveDomainParam('')).toBe('wellness-room');
    expect(resolveDomainParam(null)).toBe('wellness-room');
    expect(resolveDomainParam(undefined)).toBe('wellness-room');
    expect(resolveDomainParam('__proto__')).toBe('wellness-room');
    expect(resolveDomainParam('constructor')).toBe('wellness-room');
  });
});

describe('readDomainFromSearch', () => {
  it('returns the resolved domain when ?domain= is present', () => {
    expect(readDomainFromSearch('?domain=car')).toBe('car');
    expect(readDomainFromSearch('?domain=junk')).toBe('wellness-room');
  });

  it('returns null when there is no domain param (defer to persisted)', () => {
    expect(readDomainFromSearch('')).toBeNull();
    expect(readDomainFromSearch('?foo=bar')).toBeNull();
  });
});

describe('useDomainStore', () => {
  it('boots into wellness-room', () => {
    expect(useDomainStore.getState().activeDomain).toBe('wellness-room');
  });

  it('setDomain / resetDomain switch the active domain', () => {
    useDomainStore.getState().setDomain('car');
    expect(useDomainStore.getState().activeDomain).toBe('car');
    useDomainStore.getState().resetDomain();
    expect(useDomainStore.getState().activeDomain).toBe('wellness-room');
  });
});

describe('initDomainFromLocation', () => {
  it('applies a deep-linked ?domain=car', () => {
    expect(initDomainFromLocation('?domain=car')).toBe('car');
    expect(useDomainStore.getState().activeDomain).toBe('car');
  });

  it('leaves the persisted/default domain when no param present', () => {
    useDomainStore.getState().setDomain('airplane');
    expect(initDomainFromLocation('')).toBe('airplane');
    expect(useDomainStore.getState().activeDomain).toBe('airplane');
  });

  it('junk ?domain= deep-links to wellness-room', () => {
    useDomainStore.getState().setDomain('car');
    expect(initDomainFromLocation('?domain=junk')).toBe('wellness-room');
    expect(useDomainStore.getState().activeDomain).toBe('wellness-room');
  });
});
