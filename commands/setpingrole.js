import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setPingRole, clearPingRole, getAllPingRoles } from '../config.js';

// Same type keys used throughout the bot (CHANNEL_KEYS in config.js, plus
// the two clan-tracker feature types which use their own storage).
const PING_TYPE_CHOICES = [
  { name: 'huge', value: 'huge', label: 'Huge hatch rate posts' },
  { name: 'titanic', value: 'titanic', label: 'Titanic hatch rate posts' },
  { name: 'gargantuan', value: 'gargantuan', label: 'Gargantuan hatch rate posts' },
  { name: 'rap-alert', value: 'rapAlert', label: 'RAP change alerts' },
  { name: 'exists-alert', value: 'existsAlert', label: 'Exists spike alerts' },
  { name: 'clan-top10', value: 'clanTop10', label: 'Clan Top 10' },
  { name: 'league-top10', value: 'leagueTop10', label: 'League Top 10' },
  { name: 'game-update', value: 'gameUpdate', label: 'Game restart/update alerts' },
  { name: 'new-item', value: 'newItem', label: 'New pet/item/gamepass alerts' },
  { name: 'clan-tracker', value: 'clanTracker', label: 'Clan member contributions (every 10 min)' },
  { name: 'clan-inactivity', value: 'clanInactivity', label: 'Clan inactivity alerts' },
];

export const data = new SlashCommandBuilder()
  .setName('setpingrole')
  .setDescription('Set a role to ping for a specific alert type')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set the ping role for an alert type')
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Which alert should ping this role')
          .setRequired(true)
          .addChoices(...PING_TYPE_CHOICES.map((c) => ({ name: c.label, value: c.value })))
      )
      .addRoleOption((opt) =>
        opt.setName('role').setDescription('Role to ping').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('clear')
      .setDescription('Stop pinging a role for an alert type')
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Which alert to stop pinging for')
          .setRequired(true)
          .addChoices(...PING_TYPE_CHOICES.map((c) => ({ name: c.label, value: c.value })))
      )
  )
  .addSubcommand((sub) => sub.setName('view').setDescription('Show all configured ping roles'));

export async function execute(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const type = interaction.options.getString('type');
    const role = interaction.options.getRole('role');

    setPingRole(interaction.guildId, type, role.id);

    const label = PING_TYPE_CHOICES.find((c) => c.value === type)?.label ?? type;
    await interaction.reply(
      `✅ **${label}** will now ping ${role} when it posts.\n` +
        `-# Make sure the role is mentionable, or the bot has "Mention @everyone" style permission for this to actually ping.`
    );
    return;
  }

  if (sub === 'clear') {
    const type = interaction.options.getString('type');
    clearPingRole(interaction.guildId, type);

    const label = PING_TYPE_CHOICES.find((c) => c.value === type)?.label ?? type;
    await interaction.reply(`🛑 **${label}** will no longer ping a role.`);
    return;
  }

  if (sub === 'view') {
    const roles = getAllPingRoles(interaction.guildId);
    const lines = PING_TYPE_CHOICES.map((c) => {
      const roleId = roles[c.value];
      return `**${c.label}**: ${roleId ? `<@&${roleId}>` : '_no ping role set_'}`;
    });

    await interaction.reply({ content: lines.join('\n') });
    return;
  }
}
