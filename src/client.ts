import * as core from '@actions/core';
import * as github from '@actions/github';
import { IncomingWebhook, IncomingWebhookSendArguments } from '@slack/webhook';

export const Success = 'success';
type SuccessType = 'success';
export const Failure = 'failure';
type FailureType = 'failure';
export const Cancelled = 'cancelled';
type CancelledType = 'cancelled';
export const Custom = 'custom';
export const Always = 'always';
type AlwaysType = 'always';

export interface With {
  status: string;
  mention: string;
  author_name: string;
  if_mention: string;
  username: string;
  icon_emoji: string;
  icon_url: string;
  channel: string;
}

interface Field {
  title: string;
  value: string;
  short: boolean;
}

const groupMention = ['here', 'channel'];

export class Client {
  private webhook: IncomingWebhook;
  private github?: github.GitHub;
  private with: With;

  constructor(props: With, token?: string, webhookUrl?: string) {
    this.with = props;

    if (token !== undefined) {
      this.github = new github.GitHub(token);
    }

    if (webhookUrl === undefined) {
      throw new Error('Specify secrets.SLACK_WEBHOOK_URL');
    }
    this.webhook = new IncomingWebhook(webhookUrl);
  }

  async success(text: string) {
    const template = await this.payloadTemplate();
    template.attachments[0].color = 'good';
    template.text += this.mentionText(this.with.mention, Success);
    template.text += ':white_check_mark: Succeeded GitHub Actions\n';
    template.text += text;

    return template;
  }

  async fail(text: string) {
    const template = await this.payloadTemplate();
    template.attachments[0].color = 'danger';
    template.text += this.mentionText(this.with.mention, Failure);
    template.text += ':no_entry: Failed GitHub Actions\n';
    template.text += text;

    return template;
  }

  async cancel(text: string) {
    const template = await this.payloadTemplate();
    template.attachments[0].color = 'warning';
    template.text += this.mentionText(this.with.mention, Cancelled);
    template.text += ':warning: Canceled GitHub Actions\n';
    template.text += text;

    return template;
  }

  async send(payload: string | IncomingWebhookSendArguments) {
    core.debug(JSON.stringify(github.context, null, 2));
    await this.webhook.send(payload);
    core.debug('send message');
  }

  private async payloadTemplate() {
    const text = '';
    const { username, icon_emoji, icon_url, channel } = this.with;

    return {
      text,
      username,
      icon_emoji,
      icon_url,
      channel,
      attachments: [
        {
          color: '',
          author_name: this.with.author_name,
          fields: await this.fields(),
        },
      ],
    };
  }

  private async fields(): Promise<Field[]> {
    const { sha } = github.context;
    const { owner, repo } = github.context.repo;

    const commit = await this.github?.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });
    const author = commit?.data.commit.author;

    return this.filterField(
      [
        author
          ? {
              title: 'author',
              value: `${author.name}`,
              short: true,
            }
          : undefined,
        this.repo,
        this.ref,
        commit
          ? {
              title: 'commit message',
              value: commit.data.commit.message,
              short: true,
            }
          : undefined,
        this.commit,
        this.workflow,
        this.action,
        this.eventName,
      ],
      undefined,
    );
  }

  private get commit(): Field {
    const { sha } = github.context;
    const { owner, repo } = github.context.repo;

    return {
      title: 'commit',
      value: `<https://github.com/${owner}/${repo}/commit/${sha}|view commit>`,
      short: true,
    };
  }

  private get repo(): Field {
    const { owner, repo } = github.context.repo;

    return {
      title: 'repo',
      value: `<https://github.com/${owner}/${repo}|${repo}>`,
      short: true,
    };
  }

  private get action(): Field {
    const { sha } = github.context;
    const run_id = process.env.GITHUB_RUN_ID;
    const { owner, repo } = github.context.repo;

    return {
      title: 'action',
      value: `<https://github.com/${owner}/${repo}/actions/runs/${run_id}|view action output>`,
      short: true,
    };
  }

  private get eventName(): Field {
    return {
      title: 'event',
      value: github.context.eventName,
      short: true,
    };
  }

  private get ref(): Field {
    var branchName = github.context.ref;
    if (branchName.indexOf('refs/heads/') > -1) {
      branchName = branchName.slice('refs/heads/'.length);
    }
    return { title: 'branch', value: branchName, short: true };
  }

  private get workflow(): Field {
    return { title: 'workflow', value: github.context.workflow, short: true };
  }

  private mentionText(
    mention: string,
    status: SuccessType | FailureType | CancelledType | AlwaysType,
  ) {
    if (
      !this.with.if_mention.includes(status) &&
      this.with.if_mention !== Always
    ) {
      return '';
    }

    const normalized = mention.replace(/ /g, '');
    if (groupMention.includes(normalized)) {
      return `<!${normalized}> `;
    } else if (normalized !== '') {
      const text = normalized
        .split(',')
        .map(userId => `<@${userId}>`)
        .join(' ');
      return `${text} `;
    }
    return '';
  }

  private filterField<T extends Array<Field | undefined>, U extends undefined>(
    array: T,
    diff: U,
  ) {
    return array.filter(item => item !== diff) as Exclude<
      T extends { [K in keyof T]: infer U } ? U : never,
      U
    >[];
  }
}
