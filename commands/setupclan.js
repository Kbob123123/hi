import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { setClanTracker, clearClanTracker, getClanTracker } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('setupclan')
  .setDescription('Track a clan\'s member point gains, posted every 10 minutes')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set the clan to track and where to post contributions')
      .addStringOption((opt) =>
        opt.setName('clanname').setDescription('Exact clan name (case-sensitive)').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel to post member point gains in, every 10 minutes')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName('clear').setDescription('Stop tracking this server\'s clan'))
  .addSubcommand((sub) => sub.setName('view').setDescription('Show the currently tracked clan'));

export async function execute(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const clanName = interaction.options.getString('clanname');
    const channel = interaction.options.getChannel('channel');

    setClanTracker(interaction.guildId, clanName, channel.id);
    await interaction.reply(
      `✅ Now tracking **${clanName}**'s member point gains, posted every 10 minutes in ${channel}.\n` +
        `-# Clan name must match exactly (case-sensitive) — if nothing posts after ~20 minutes, double-check the spelling.\n` +
        `-# Want inactivity alerts too? Use /setupclan-inactivity.`
    );
    return;
  }

  if (sub === 'clear') {
    clearClanTracker(interaction.guildId);
    await interaction.reply('🛑 Clan member tracking has been disabled for this server.');
    return;
  }

  if (sub === 'view') {
    const tracker = getClanTracker(interaction.guildId);
    if (!tracker) {
      await interaction.reply('No clan is currently being tracked. Use `/setupclan set` to configure one.');
      return;
    }
    await interaction.reply(`Currently tracking **${tracker.clanName}** → <#${tracker.channelId}>`);
    return;
  }
}
