import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, useCachedPromise, useForm } from "@raycast/utils";
import {
  addHelmServices,
  createHelmSubEnvironment,
  getEnvironmentServices,
  waitForEnvironmentToBeReady,
  type Environment,
} from "../api/environments";

type CreateSubEnvironmentFormProps = {
  projectKey: string;
  testEnvironments: Environment[];
  defaultBaseEnvironmentKey: string | undefined;
  onCreate: () => void;
};

type CreateSubEnvironmentValues = {
  baseEnvironmentKey: string;
  name: string;
  namespace: string;
  serviceNames: string[];
};

// ! Mirrors Zadig's own naming, so a new environment never lands in a namespace someone else already uses, which Delete Environment would wipe.
const getDefaultNamespace = (projectKey: string, name: string) => `${projectKey}-env-${name}`;

export default function CreateSubEnvironmentForm({
  projectKey,
  testEnvironments,
  defaultBaseEnvironmentKey,
  onCreate,
}: CreateSubEnvironmentFormProps) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps, values } = useForm<CreateSubEnvironmentValues>({
    initialValues: { baseEnvironmentKey: defaultBaseEnvironmentKey ?? testEnvironments[0]?.env_key, serviceNames: [] },
    validation: {
      baseEnvironmentKey: FormValidation.Required,
      name: name => {
        if (!name) {
          return "The item is required";
        }

        if (testEnvironments.some(({ env_key }) => env_key === name)) {
          return "An environment with this name already exists";
        }
      },
    },
    async onSubmit({ baseEnvironmentKey, name, namespace, serviceNames }) {
      const baseEnvironment = testEnvironments.find(({ env_key }) => env_key === baseEnvironmentKey);

      if (!baseEnvironment) {
        return;
      }

      const toast = await showToast({ style: Toast.Style.Animated, title: `Creating ${name}` });

      try {
        await createHelmSubEnvironment(projectKey, {
          name,
          namespace: namespace || getDefaultNamespace(projectKey, name),
          baseEnvironment,
        });
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = `Failed to create ${name}`;
        toast.message = error instanceof Error ? error.message : undefined;
        return;
      }

      onCreate();

      try {
        if (serviceNames.length > 0) {
          toast.title = `Adding services to ${name}`;
          const createdEnvironment = await waitForEnvironmentToBeReady(projectKey, name);
          await addHelmServices(projectKey, createdEnvironment, serviceNames);
        }

        toast.style = Toast.Style.Success;
        toast.title = `Created ${name}`;
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = `Created ${name}, but could not add its services`;
        toast.message = error instanceof Error ? error.message : undefined;
      }

      pop();
    },
  });
  const { data: baseEnvironmentServices, isLoading } = useCachedPromise(
    getEnvironmentServices,
    [projectKey, values.baseEnvironmentKey, false],
    { execute: Boolean(values.baseEnvironmentKey) },
  );

  return (
    <Form
      navigationTitle="Create Sub-Environment"
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Sub-Environment" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        title="Base Environment"
        info="The new environment shares this environment's services and uses its cluster and registry."
        {...itemProps.baseEnvironmentKey}
      >
        {testEnvironments.map(({ env_key }) => (
          <Form.Dropdown.Item key={env_key} title={env_key} value={env_key} icon={Icon.Layers} />
        ))}
      </Form.Dropdown>
      <Form.TextField title="Name" placeholder="dev42" {...itemProps.name} />
      <Form.TextField
        title="Namespace"
        placeholder={getDefaultNamespace(projectKey, values.name || "<name>")}
        info="Leave it empty to use Zadig's default, which no other environment shares."
        {...itemProps.namespace}
      />
      <Form.TagPicker title="Services" {...itemProps.serviceNames}>
        {baseEnvironmentServices?.map(({ serviceName }) => (
          <Form.TagPicker.Item key={serviceName} title={serviceName} value={serviceName} icon={Icon.Box} />
        ))}
      </Form.TagPicker>
    </Form>
  );
}
