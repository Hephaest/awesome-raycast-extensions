import { Color, Icon, MenuBarExtra, open } from "@raycast/api";
import usePulls from "./hooks/usePulls";
import { CATEGORIES, INBOUND_CATEGORY_IDS, OUTBOUND_CATEGORY_IDS } from "./constants";
import PullRequestItem from "./components/PullRequestItem";
import { CategoryId, PullRequestShort } from "./types";

const actionablePullRequests = () => {
  const { isLoading, isReady, categoryPulls, recentlyVisitedPulls, visitPull, runPullIteration } = usePulls();

  const openPull = (pull: PullRequestShort) =>
    open(pull.url)
      .then(() => visitPull(pull))
      .catch(console.error);

  const renderCategoryMenu = (id: CategoryId) => {
    const { pulls, total } = categoryPulls[id];
    const { title, icon } = CATEGORIES[id];
    const isEnabled = total > 0;

    return (
      <MenuBarExtra.Submenu
        key={id}
        title={`${title}${total ? ` (${total})` : ""}`}
        icon={{ source: icon, tintColor: isEnabled ? Color.PrimaryText : Color.SecondaryText }}
      >
        {pulls.map((pull, index) => (
          <PullRequestItem key={pull.id} pull={pull} index={index} onAction={() => openPull(pull)} />
        ))}
      </MenuBarExtra.Submenu>
    );
  };

  const totalCount = new Set(Object.values(categoryPulls).flatMap(category => category.pulls.map(pull => pull.id)))
    .size;
  const title = totalCount > 0 ? `${totalCount}` : "🎉";
  const hasNoPulls = Object.values(categoryPulls).every(category => category.pulls.length === 0);

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={{ source: "icon.png", tintColor: Color.PrimaryText }}
      title={title}
      tooltip="Your Pull Requests"
    >
      {hasNoPulls && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title="🧹 No upcoming PRs." />
        </MenuBarExtra.Section>
      )}
      <MenuBarExtra.Section>
        <MenuBarExtra.Submenu
          title="Recent"
          icon={{
            source: Icon.Clock,
            tintColor: recentlyVisitedPulls.length > 0 ? Color.PrimaryText : Color.SecondaryText,
          }}
        >
          {recentlyVisitedPulls.map(pull => (
            <PullRequestItem key={pull.id} pull={pull} onAction={() => openPull(pull)} />
          ))}
        </MenuBarExtra.Submenu>
      </MenuBarExtra.Section>

      <MenuBarExtra.Section>{INBOUND_CATEGORY_IDS.map(renderCategoryMenu)}</MenuBarExtra.Section>

      <MenuBarExtra.Section>{OUTBOUND_CATEGORY_IDS.map(renderCategoryMenu)}</MenuBarExtra.Section>

      {isReady && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item
            title="Force Refresh"
            onAction={runPullIteration}
            icon={Icon.RotateClockwise}
            shortcut={{ key: "r", modifiers: ["cmd"] }}
          />
        </MenuBarExtra.Section>
      )}
    </MenuBarExtra>
  );
};

// noinspection JSUnusedGlobalSymbols
export default actionablePullRequests;
