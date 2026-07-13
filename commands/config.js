import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import {
  CHANNEL_KEYS,
  getGuildConfig,
  setGuildChannel,
  clearGuildChannel,
  clearAllGuildConfig,
  clearClanTracker,
  clearClanInactivityConfig,
  getClanTracker,
  getClanInactivityConfig,
} from '../config.js';

const CHANNEL_CHOICES = [
  { name: 'huge', value: 'huge', label: 'Huge hatch rate posts' },
  { name: 'titanic', value: 'titanic', label: 'Titanic hatch rate posts' },
  { name: 'gargantuan', value: 'gargantuan', label: 'Gargantuan hatch rate posts' },
  { name: 'rap-alert', value: 'rapAlert', label: 'RAP change alerts (±200%, Titanic/Gargantuan)' },
  { name: 'exists-alert', value: 'existsAlert', label: 'Exists spike alerts (2x+, Titanic/Gargantuan)' },
  { name: 'clan-top10', value: 'clanTop10', label: 'Clan Top 10 (auto-posts every 10 min)' },
  { name: 'league-top10', value: 'leagueTop10', label: 'League Top 10 (auto-posts every 10 min)' },
  { name: 'game-update', value: 'gameUpdate', label: 'Game restart/update alerts' },
  { name: 'new-item', value: 'newItem', label: 'New pet/item/gamepass alerts' },
];

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure this server\'s PS99 bot channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set the channel for a tracker/alert type')
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Which feed to configure')
          .setRequired(true)
          .addChoices(...CHANNEL_CHOICES.map((c) => ({ name: c.label, value: c.value })))
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel to post in')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('clear')
      .setDescription('Disable a feed for this server')
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Which feed to disable')
          .setRequired(true)
          .addChoices(...CHANNEL_CHOICES.map((c) => ({ name: c.label, value: c.value })))
      )
  )
  .addSubcommand((sub) => sub.setName('view').setDescription('Show this server\'s current configuration'))
  .addSubcommand((sub) =>
    sub.setName('reset').setDescription('Clear ALL configuration for this server')
  );

export async function execute(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    const key = CHANNEL_KEYS[type];

    setGuildChannel(interaction.guildId, key, channel.id);

    const label = CHANNEL_CHOICES.find((c) => c.value === type)?.label ?? type;
    await interaction.reply(`✅ **${label}** will now post in ${channel}.`);
    return;
  }

  if (sub === 'clear') {
    const type = interaction.options.getString('type');
    const key = CHANNEL_KEYS[type];
    clearGuildChannel(interaction.guildId, key);

    const label = CHANNEL_CHOICES.find((c) => c.value === type)?.label ?? type;
    await interaction.reply(`🛑 **${label}** has been disabled for this server.`);
    return;
  }

  if (sub === 'reset') {
    clearAllGuildConfig(interaction.guildId);
    clearClanTracker(interaction.guildId);
    clearClanInactivityConfig(interaction.guildId);
    await interaction.reply('🧹 All PS99 bot configuration for this server has been cleared.');
    return;
  }

  if (sub === 'view') {
    const cfg = getGuildConfig(interaction.guildId);
    const clanTracker = getClanTracker(interaction.guildId);
    const inactivity = getClanInactivityConfig(interaction.guildId);

    const lines = CHANNEL_CHOICES.map((c) => {
      const channelId = cfg[CHANNEL_KEYS[c.value]];
      return `**${c.label}**: ${channelId ? `<#${channelId}>` : '_not configured_'}`;
    });

    lines.push(
      `**Clan Member Tracker**: ${
        clanTracker ? `${clanTracker.clanName} → <#${clanTracker.channelId}>` : '_not configured (use /setupclan)_'
      }`
    );
    lines.push(
      `**Clan Inactivity Alerts**: ${
        inactivity
          ? `${inactivity.enabled ? 'ON' : 'OFF'} → <#${inactivity.channelId}>`
          : '_not configured (use /setupclan-inactivity)_'
      }`
    );

    const embed = new EmbedBuilder()
      .setTitle('PS99 Bot Configuration')
      .setColor(0x2ecc71)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Use /config set to configure a feed, /config clear to disable one.' });

    await interaction.reply({ embeds: [embed] });
    return;
  }
}
