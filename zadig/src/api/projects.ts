import { request } from "./request";

export type Project = {
  project_key: string;
  project_name: string;
  deploy_type: string;
};

type ProjectPage = {
  total: number;
  projects: Project[];
};

// Pages through the list at the server's default page size until every project is loaded.
export async function getAllProjects() {
  const projects: Project[] = [];

  for (let pageNum = 1; ; pageNum++) {
    const page = await request<ProjectPage>("/projects/project", { params: { pageNum } });
    projects.push(...page.projects);

    if (page.projects.length === 0 || projects.length >= page.total) {
      return projects;
    }
  }
}
