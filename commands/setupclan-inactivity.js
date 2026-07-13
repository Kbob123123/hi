import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import {
  setClanInactivityConfig,
  getClanInactivityConfig,
  clearClanInactivityConfig,
  getClanTracker,
} from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('setupclan-inactivity')
  .setDescription('Configure standalone alerts for clan members with zero point gain in the last 10 minutes')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set the channel and turn inactivity alerts on/off')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel to post inactivity alerts in')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addBooleanOption((opt) =>
        opt.setName('enabled').setDescription('Turn inactivity alerts on or off').setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName('view').setDescription('Show the current inactivity alert setting'));

export async function execute(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const channel = interaction.options.getChannel('channel');
    const enabled = interaction.options.getBoolean('enabled');

    const clanTracker = getClanTracker(interaction.guildId);
    if (!clanTracker) {
      await interaction.reply(
        '⚠️ You need to set up a clan to track first — use `/setupclan set` before configuring inactivity alerts.'
      );
      return;
    }

    setClanInactivityConfig(interaction.guildId, channel.id, enabled);
    await interaction.reply(
      enabled
        ? `✅ Inactivity alerts are **ON** — members of **${clanTracker.clanName}** with 0 point gain in a 10-min cycle will be posted in ${channel}.`
        : `🛑 Inactivity alerts are now **OFF** for this server.`
    );
    return;
  }

  if (sub === 'view') {
    const cfg = getClanInactivityConfig(interaction.guildId);
    if (!cfg) {
      await interaction.reply('Inactivity alerts are not configured. Use `/setupclan-inactivity set` to configure.');
      return;
    }
    await interaction.reply(`Inactivity alerts: **${cfg.enabled ? 'ON' : 'OFF'}** → <#${cfg.channelId}>`);
    return;
  }
}
