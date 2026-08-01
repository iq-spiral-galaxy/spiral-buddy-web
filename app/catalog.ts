import blueCatalogData from "@/data/catalog.json";
import blueTrackData from "@/data/tracks/blue.json";
import redTrackData from "@/data/tracks/red.json";
import greenTrackData from "@/data/tracks/green.json";
import blackTrackData from "@/data/tracks/black.json";
import whiteTrackData from "@/data/tracks/white.json";
import { repoTitle } from "@/app/title-utils";

export { learningTitle, repoTitle } from "@/app/title-utils";

export type LearningCategory = {
  id: string;
  name: string;
  description: string;
  repos: string[];
};

export type LearningDomain = {
  id: string;
  name: string;
  englishName: string;
  description: string;
  color: string;
  categories: LearningCategory[];
};

export type LearningTrack = {
  id: string;
  name: string;
  shortName: string;
  philosophy: string;
  subject: string;
  koreanSubject: string;
  organization: string;
  defaultBranch: string;
  color: string;
  softColor: string;
  swatch: string;
  heroEyebrow: string;
  heroLead: string;
  heroAccent: string;
  description: string;
  domains: LearningDomain[];
};

export type RepoLocation = {
  slug: string;
  title: string;
  track: LearningTrack;
  domain: LearningDomain;
  category: LearningCategory;
};

type TrackMetadata = Omit<LearningTrack, "domains">;

const blueTrack: LearningTrack = {
  ...(blueTrackData as TrackMetadata),
  organization: blueCatalogData.organization,
  domains: blueCatalogData.domains as LearningDomain[],
};

export const learningTracks: LearningTrack[] = [
  blueTrack,
  redTrackData as LearningTrack,
  greenTrackData as LearningTrack,
  blackTrackData as LearningTrack,
  whiteTrackData as LearningTrack,
];

export const catalogOrganization = blueTrack.organization;
export const learningDomains = blueTrack.domains;

export const repoLocations: RepoLocation[] = learningTracks.flatMap((track) =>
  track.domains.flatMap((domain) =>
    domain.categories.flatMap((category) =>
      category.repos.map((slug) => ({
        slug,
        title: repoTitle(slug),
        track,
        domain,
        category,
      })),
    ),
  ),
);

export const totalRepoCount = repoLocations.length;

export function getTrack(trackId: string) {
  return learningTracks.find((track) => track.id === trackId);
}

export function getTrackRepoCount(track: LearningTrack) {
  return track.domains.reduce((total, domain) => total + getDomainRepoCount(domain), 0);
}

export function getTrackCategoryCount(track: LearningTrack) {
  return track.domains.reduce((total, domain) => total + domain.categories.length, 0);
}

export function getRepoUrl(slug: string, trackId = "blue") {
  const track = getTrack(trackId) ?? blueTrack;
  return `https://github.com/${track.organization}/${slug}`;
}

export function getDomainRepoCount(domain: LearningDomain) {
  return domain.categories.reduce((total, category) => total + category.repos.length, 0);
}

export function findRepo(slug: string, trackId = "blue") {
  return repoLocations.find((repo) => repo.track.id === trackId && repo.slug === slug);
}
