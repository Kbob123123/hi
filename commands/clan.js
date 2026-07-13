import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getClan } from '../ps99Api.js';
import { formatNumber, formatCompact } from '../format.js';
import { resolveThumbnail } from '../thumbnails.js';

export const data = new SlashCommandBuilder()
  .setName('clan')
  .setDescription('Look up a PS99 clan by name')
  .addStringOption((opt) =>
    opt.setName('name').setDescription('Exact clan name').setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const name = interaction.options.getString('name');

  try {
    const clan = await getClan(name);

    // CONFIRMED real shape (verified against a live response for "UN0"):
    // Members is an ARRAY of {UserID, PermissionLevel, JoinTime} — a roster,
    // not a count. There's no top-level "Points" field on a single clan;
    // clan-wide points live per-battle under Battles.{BattleID}.Points.
    // The old code read clan.Members as a number and clan.Points as a
    // top-level field, producing "[object Object]/75" and "N/A" — fixed here.
    const memberCount = Array.isArray(clan.Members) ? clan.Members.length : clan.Members ?? '?';

    // Pull the most recent battle's points as a stand-in "current points"
    // figure, since there's no single clan-wide total. Battles is a map of
    // BattleID -> {Points, Place, ...}; without a documented "current battle"
    // marker, we take the entry with the highest Points as a reasonable
    // proxy for "the battle currently being contested" — this is a judgment
    // call, not a confirmed API guarantee.
    const battles = clan.Battles ?? {};
    const battleEntries = Object.entries(battles);
    const topBattle = battleEntries.length
      ? battleEntries.reduce((a, b) => ((b[1]?.Points ?? 0) > (a[1]?.Points ?? 0) ? b : a))
      : null;

    const embed = new EmbedBuilder()
      .setTitle(clan.Name ?? name)
      .setColor(0x57f287)
      .addFields(
        { name: 'Members', value: `${formatNumber(memberCount)}/${clan.MemberCapacity ?? '?'}`, inline: true },
        { name: 'Deposited Diamonds', value: formatCompact(clan.DepositedDiamonds), inline: true },
        { name: 'Country', value: clan.CountryCode ?? 'N/A', inline: true },
        { name: 'Guild Level', value: `${clan.GuildLevel ?? '?'}`, inline: true },
        { name: 'Gold / Silver / Good Medals', value: `${clan.GoldMedals ?? 0} / ${clan.SilverMedals ?? 0} / ${clan.GoodMedals ?? 0}`, inline: true }
      );

    if (topBattle) {
      const [battleId, battleData] = topBattle;
      embed.addFields({
        name: `Latest Battle (${battleId})`,
        value: `${formatCompact(battleData.Points)} pts${battleData.Place ? ` · Rank #${formatNumber(battleData.Place)}` : ''}${battleData.EarnedMedal ? ` · ${battleData.EarnedMedal}` : ''}`,
      });
    }

    if (clan.Icon) {
      const iconUrl = await resolveThumbnail(clan.Icon, '150x150');
      if (iconUrl) embed.setThumbnail(iconUrl);
    }

    if (clan.Created) {
      embed.setFooter({ text: `Created ${new Date(clan.Created * 1000).toLocaleDateString()}` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    // Log the FULL error (not just .message) so a real network/fetch failure
    // is distinguishable from a genuine "clan not found" API response —
    // both currently show the same generic message to the user, which made
    // a real bug look like a typo'd clan name in an earlier report.
    console.error(`[clan] Lookup failed for "${name}":`, err);
    if (err.apiError) console.error('[clan] API error detail:', JSON.stringify(err.apiError));

    await interaction.editReply(
      `Couldn't find clan **${name}**. This could mean: the name doesn't match exactly (case-sensitive), ` +
        `or the PS99 API is temporarily unreachable. Check the bot's console log for the specific error.`
    );
  }
}
