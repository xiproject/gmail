# Gmail 

Polls for new email periodically, and notifies you when one arrives. You can ask the agent to read out the mail or the subject.

## Prerequisites
- node v0.10
- [bunyan](https://github.com/trentm/node-bunyan) for pretty printed logs

## Installation

### Step 1: Download
Clone this repo and run `npm install`

### Step 2: Enable the Gmail API 
Follow the full instructions [Google Developers](https://developers.google.com/gmail/api/quickstart/quickstart-python#step_1_enable_the_gmail_api).
site. They are briefly reproduced below.

You need to first [create or select a project in the Google Developers Console and enable the API](https://console.developers.google.com//start/api?id=gmail&credential=client_key).

Alternatively, you can activate the Gmail API yourself in the Developers Console by doing the following:

1. Go to the [Google Developers Console](https://console.developers.google.com/).
2. Select a project, or create a new one.
3. In the sidebar on the left, expand **APIs & auth**. Next, click **APIs**. In the list of APIs, make sure the status is ON for the Gmail API.
4. In the sidebar on the left, select **Credentials**.

In either case, you end up on the **Credentials** page and can create your project's credentials from here.

### Step 3: Download credentials 
1. From the Credentials page, click **Create new Client ID** under the OAuth heading to create your OAuth 2.0 credentials.
2. Next, select your Client ID type as **Installed application**.
3. Your application's Client ID and relevant auth settings are now listed.
4. Click on the **Download JSON** button, and save the file to `auth.json` in the agent folder.

## Run
- Launch the agent
```sh
node index.js --logfile gmail.log 2>&1 | bunyan
```
- On the first run, the agent will open a browser window to login. If you later wish to change the signed-in account, remove `tokens.json` from the agent folder.
