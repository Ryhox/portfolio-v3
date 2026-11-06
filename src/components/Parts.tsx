'use client';

import { lazy, type ComponentProps } from 'react';

/**
 * The page's parts further down, each its own script: the server renders them whole (the page looks the same from the
 * first paint), but in the browser their code is fetched only when their `Later` boundary wakes them (near the screen,
 * on taking the pill, or once you do anything). Until then the landing's code is the only code the page runs.
 */
const AboutPart = lazy(() => import('./site/About'));
const CrewPart = lazy(() => import('./site/Crew'));
const DivePart = lazy(() => import('./site/Dive'));
const WorkPart = lazy(() => import('./Work'));
const PlayPart = lazy(() => import('./PlayUI'));
const FxPart = lazy(() => import('./site/SiteFx'));
const SocialsPart = lazy(() => import('./Socials'));

export const About = () => <AboutPart />;
export const Crew = () => <CrewPart />;
export const Dive = () => <DivePart />;
export const Work = () => <WorkPart />;
export const PlayUI = () => <PlayPart />;
export const SiteFx = () => <FxPart />;
export const Socials = (props: ComponentProps<typeof SocialsPart>) => <SocialsPart {...props} />;
