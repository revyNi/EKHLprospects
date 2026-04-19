import LoadingExperience from '../../components/LoadingExperience'

export const unstable_instant = true

export default function Loading() {
  return <LoadingExperience variant="league" label="Loading leagues, standings paths, and competition data..." />
}
