import LoadingExperience from '../components/LoadingExperience'

export const unstable_instant = true

export default function Loading() {
  return <LoadingExperience variant="home" label="Pulling stats, lineups, and storylines together..." />
}
