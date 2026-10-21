import { Icon, List } from "@raycast/api";
import { getAvatarIcon, useCachedPromise } from "@raycast/utils";
import { getEnvironmentServices, type Environment } from "../api/environments";
import { formatTime } from "../formatTime";
import { getStatusColor } from "../statusColor";

type EnvironmentDetailProps = {
  projectKey: string;
  environment: Environment;
};

// The image tag tells which build is deployed, so each service shows as `name:tag`.
const getImageTag = (image: string) => image.split("/").at(-1)?.split(":").at(1);

export default function EnvironmentDetail({ projectKey, environment }: EnvironmentDetailProps) {
  const { data: services = [], isLoading } = useCachedPromise(getEnvironmentServices, [
    projectKey,
    environment.env_key,
    environment.production,
  ]);

  return (
    <List.Item.Detail
      isLoading={isLoading}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.TagList title="Status">
            <List.Item.Detail.Metadata.TagList.Item
              text={environment.status}
              color={getStatusColor(environment.status)}
            />
          </List.Item.Detail.Metadata.TagList>
          <List.Item.Detail.Metadata.Label
            title="Last Update Person"
            icon={getAvatarIcon(environment.update_by)}
            text={environment.update_by}
          />
          <List.Item.Detail.Metadata.Label
            title="Last Update Time"
            icon={Icon.Clock}
            text={formatTime(environment.update_time)}
          />
          <List.Item.Detail.Metadata.Label title="Namespace" icon={Icon.Tag} text={environment.namespace} />
          {services.length > 0 && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.TagList title="Services">
                {services.map(service => {
                  const imageTag = getImageTag(service.images.at(0) ?? "");

                  return (
                    <List.Item.Detail.Metadata.TagList.Item
                      key={service.serviceName}
                      icon={Icon.Box}
                      text={imageTag ? `${service.serviceName}:${imageTag}` : service.serviceName}
                    />
                  );
                })}
              </List.Item.Detail.Metadata.TagList>
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
