import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { findLeagueByName } from '../ps99Api.js';
import { getLeagueRate, recordLeagueSnapshot, getLeagueSeries } from '../history.js';
import { formatCompact, formatNumber } from '../format.js';
import { resolveThumbnail } from '../thumbnails.js';
import { buildPetExistsChartUrl } from '../charts.js';

// NOTE ON SCOPE: the public API has no endpoint returning per-player
// contribution data for a league (only league-level Members/ContributorCount
// counts) — confirmed by testing /v1/leagues, /v1/leagues/{id},
// /v1/leagues?name=X live against the real API. So this command shows
// league-level stats and an exact hourly points rate for the league as a
// whole, not a per-player breakdown.
export const data = new SlashCommandBuilder()
  .setName('league')
  .setDescription('Look up a specific league by name')
  .addStringOption((opt) =>
    opt.setName('name').setDescription('League name (partial match ok)').setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const name = interaction.options.getString('name');

  try {
    const league = await findLeagueByName(name);

    if (!league) {
      await interaction.editReply(
        `No league found matching **${name}**. Try the exact name — there are tens of thousands of ` +
          `leagues and this searches by scanning, so very obscure/partial names may not be found quickly.`
      );
      return;
    }

    const key = `league:${league.Name}`;
    recordLeagueSnapshot(key, league.Points);
    const rate = getLeagueRate(key);
    const rateText = rate
      ? `${rate.perHour >= 0 ? '+' : ''}${formatCompact(rate.perHour)}/hr`
      : 'gathering data… (takes up to an hour of tracking)';

    const embed = new EmbedBuilder()
      .setTitle(`🏅 League: ${league.Name}`)
      .setColor(0x3498db)
      .addFields(
        { name: 'Points', value: `${formatNumber(league.Points)} (${rateText})`, inline: true },
        { name: 'Level', value: `${league.Level ?? '?'}`, inline: true },
        { name: 'Members', value: `${league.Members ?? '?'}/${league.MemberCapacity ?? '?'}`, inline: true },
        { name: 'Contributors', value: `${league.ContributorCount ?? '?'}`, inline: true }
      )
      .setFooter({
        text: 'Rate is an exact trailing-1-hour count for the league as a whole (no per-player data available from the public API)',
      })
      .setTimestamp();

    if (league.Icon) {
      const iconUrl = await resolveThumbnail(league.Icon, '150x150');
      if (iconUrl) embed.setThumbnail(iconUrl);
    }

    const series = getLeagueSeries(key);
    const chartUrl = await buildPetExistsChartUrl(league.Name, series, { label: 'Points Over Time', color: '#4fc3f7' });
    if (chartUrl) embed.setImage(chartUrl);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`Couldn't fetch league data: ${err.message}`);
  }
}
