# Awesome Raycast Extensions
A collection of custom extensions designed to streamline your working workflows with Raycast, especially when you're using Jira and GitHub.

> **Disclaimer:**
>
> These Raycast extensions were created by other developers. Full credit goes to the original authors for their foundational work.
>
> My contributions focus on adding new features and optimizing the extensions for better performance and user experience.

## 🧩 Extensions
### Jira
My Filter is a great productivity command because you don’t need to click on the slow Jira webpage every day. You can still track all the lists using the filters you created or used.

However, the official extension prioritizes functionality over usability, which is frustrating when the list is filled with tasks with the same name, frustrating power users like me.

To solve this issue, I slightly adjusted the display layout. In addition, the extension now supports showing the parent task (if it exists). Once you install the extension, you’ll be able to distinguish all tasks more easily through visual cues in the user interface.

|Before|After|
|:---:|:---:|
|![jira-filter-before](https://github.com/user-attachments/assets/b7a14d48-2000-4a9f-8564-d58f25e50f18)|![jira-filter-after](https://github.com/user-attachments/assets/ba3c6ac4-998e-4815-8894-e1f06917a03e)|

### GitHub
At work, I saw people mainly have 2 ways to deal with code review:
1. Just approve, no one cares about the code. In this case, developers will finally take huge tech debt prices for their choice (unless your team is full of well-behaved talents, which is most likely impossible in the real world because of labour cost control).
2. Conduct thorough code reviews and provide extensive comments. The thing is it will take a long time for both reviewers and authors to complete their job if they can't communicate efficiently.

Personally, I prefer option #2 because I believe people can benefit from thorough code reviews. To streamline the code review process, I have revamped the menu bar. My goal is to help authors clearly track all their ongoing pull requests, whether they are under review or have requested changes. So as for reviewers.

Moreover, my team members like to mark their ongoing but not-ready PRs as drafts so I also include this feature in this version. Feel free to try it out!

<p align="center">
<img width="200" alt="github-extension" src="https://github.com/user-attachments/assets/654bd28e-d371-4778-bd66-f17b4ce941cd" />
</p>

## 🛠 Installation
1. Clone this repo to your desktop.
2. Open Reycast and type "Import Extensions."
3. Open your cloned repository and select the specific extension folder (not the root folder). For example, choose either the `jira` or `github-review-requests` folder.
4. Open the Reycast Extension Settings window.
5. Configure the necessary settings for the extension, such as your Personal Access Token.

<p align="center">
<img width="400" alt="image" src="https://github.com/user-attachments/assets/b8ba9bcc-d30f-4963-9314-d470879beb43" />
</p>


That’s all. You can begin your new journey with our awesome extensions! 🎉

## 📬 Contributions
Contributions are welcome! Feel free to fork this repository, submit pull requests, or open issues for any bugs or feature requests.
