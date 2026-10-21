import { Action, ActionPanel, Alert, confirmAlert, Icon, List, showToast, Toast } from "@raycast/api";
import { useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { deleteEnvironment, getEnvironments, type Environment } from "./api/environments";
import { ZadigError } from "./api/request";
import AddServicesForm from "./components/AddServicesForm";
import CreateSubEnvironmentForm from "./components/CreateSubEnvironmentForm";
import EnvironmentDetail from "./components/EnvironmentDetail";
import ProjectDropdown from "./components/ProjectDropdown";
import RestartServiceSubmenu from "./components/RestartServiceSubmenu";
import { useProjects } from "./hooks/useProjects";
import { getEnvironmentUrl } from "./webUrls";

// Users without production access get a 403, which hides the section rather than failing the command.
async function getEnvironmentsUnlessForbidden(projectKey: string, production: boolean) {
  try {
    return await getEnvironments(projectKey, production);
  } catch (error) {
    if (error instanceof ZadigError && error.status === 403) {
      return [];
    }

    throw error;
  }
}

export default function SearchEnvironments() {
  const { projects, project, isLoading: isLoadingProjects, setProjectKey } = useProjects("searchEnvironments");
  const projectKey = project?.project_key ?? "";
  // NOTE: Creating environments and adding services is only verified on Helm projects, so other project types do not offer it.
  const isHelmProject = project?.deploy_type === "helm";
  const {
    data: testEnvironments = [],
    isLoading: isLoadingTestEnvironments,
    revalidate: revalidateTestEnvironments,
  } = useCachedPromise(getEnvironments, [projectKey, false], { execute: Boolean(projectKey) });
  const { data: productionEnvironments, isLoading: isLoadingProductionEnvironments } = useCachedPromise(
    getEnvironmentsUnlessForbidden,
    [projectKey, true],
    { execute: Boolean(projectKey) },
  );
  const getFrecencyKey = (environment: Environment) => `${projectKey}/${environment.env_key}`;
  const { data: sortedTestEnvironments, visitItem: visitTestEnvironment } = useFrecencySorting(testEnvironments, {
    namespace: "environments",
    key: getFrecencyKey,
  });
  const { data: sortedProductionEnvironments, visitItem: visitProductionEnvironment } = useFrecencySorting(
    productionEnvironments,
    { namespace: "environments", key: getFrecencyKey },
  );

  async function confirmDelete(environment: Environment) {
    const isConfirmed = await confirmAlert({
      title: `Delete ${environment.env_key}?`,
      message: `This deletes ${environment.env_key} with its namespace ${environment.namespace} and every workload in it. It cannot be undone.`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });

    if (!isConfirmed) {
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: `Deleting ${environment.env_key}` });

    try {
      await deleteEnvironment(projectKey, environment);
      toast.style = Toast.Style.Success;
      toast.title = `Deleted ${environment.env_key}`;
      revalidateTestEnvironments();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = `Failed to delete ${environment.env_key}`;
      toast.message = error instanceof Error ? error.message : undefined;
    }
  }

  const renderEnvironment = (environment: Environment, visitItem: (environment: Environment) => Promise<void>) => (
    <List.Item
      key={environment.env_key}
      icon={Icon.Layers}
      title={environment.env_key}
      keywords={[environment.namespace, environment.status, environment.update_by]}
      detail={<EnvironmentDetail projectKey={projectKey} environment={environment} />}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser
              url={getEnvironmentUrl(projectKey, environment.env_key)}
              onOpen={() => visitItem(environment)}
            />
            <Action.CopyToClipboard title="Copy Environment Name" content={environment.env_key} />
            {isHelmProject && testEnvironments.length > 0 && (
              <Action.Push
                title="Create Sub-Environment"
                icon={Icon.Plus}
                target={
                  <CreateSubEnvironmentForm
                    projectKey={projectKey}
                    testEnvironments={testEnvironments}
                    defaultBaseEnvironmentKey={environment.production ? undefined : environment.env_key}
                    onCreate={revalidateTestEnvironments}
                  />
                }
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section title="Operations">
            {isHelmProject && !environment.production && testEnvironments.length > 1 && (
              <Action.Push
                title="Add Services"
                icon={Icon.PlusSquare}
                target={
                  <AddServicesForm
                    projectKey={projectKey}
                    environment={environment}
                    sourceEnvironments={testEnvironments.filter(({ env_key }) => env_key !== environment.env_key)}
                    onAdd={revalidateTestEnvironments}
                  />
                }
              />
            )}
            <RestartServiceSubmenu projectKey={projectKey} environment={environment} />
          </ActionPanel.Section>
          {!environment.production && (
            <ActionPanel.Section title="Danger Zone">
              <Action
                title="Delete Environment"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={() => confirmDelete(environment)}
              />
            </ActionPanel.Section>
          )}
        </ActionPanel>
      }
    />
  );

  return (
    <List
      isShowingDetail
      isLoading={isLoadingProjects || isLoadingTestEnvironments || isLoadingProductionEnvironments}
      searchBarPlaceholder="Search environments by name, status or updater"
      searchBarAccessory={<ProjectDropdown projects={projects} value={project?.project_key} onChange={setProjectKey} />}
    >
      <List.Section title="Test">
        {sortedTestEnvironments.map(environment => renderEnvironment(environment, visitTestEnvironment))}
      </List.Section>
      <List.Section title="Production">
        {sortedProductionEnvironments.map(environment => renderEnvironment(environment, visitProductionEnvironment))}
      </List.Section>
    </List>
  );
}
