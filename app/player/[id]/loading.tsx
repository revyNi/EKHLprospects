import LoadingExperience from '../../../components/LoadingExperience'

export const unstable_instant = true

export default function Loading() {
  return <LoadingExperience variant="player" label="Loading player profile, career stats, and recent facts..." />
}
