import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getTopLeagues } from '../ps99Api.js';
import {
  getLeagueRate,
  recordLeagueSnapshot,
  getLeagueSeries,
  estimateHoursToOvertake,
  formatHours,
} from '../history.js';
import { formatCompact } from '../format.js';
import { resolveThumbnail } from '../thumbnails.js';
import { buildMultiSeriesChartUrl } from '../charts.js';

export const data = new SlashCommandBuilder()
  .setName('leaguetop10')
  .setDescription('Top 10 leagues by points, with exact hourly rates and time-to-overtake estimates');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const leagues = await getTopLeagues(10);

    if (!leagues || leagues.length === 0) {
      await interaction.editReply('No league data available.');
      return;
    }

    const rows = leagues.map((league) => {
      const key = `league:${league.Name}`;
      recordLeagueSnapshot(key, league.Points);
      return {
        name: league.Name,
        points: league.Points,
        icon: league.Icon,
        key,
        rate: getLeagueRate(key),
      };
    });

    const embed = new EmbedBuilder()
      .setTitle('🏅 League Top 10')
      .setColor(0x3498db)
      .setFooter({
        text: 'Rates are an exact trailing-1-hour count · takes up to an hour after bot startup to appear',
      })
      .setTimestamp();

    rows.forEach((row, i) => {
      const rank = i + 1;
      const rateText = row.rate
        ? `${row.rate.perHour >= 0 ? '+' : ''}${formatCompact(row.rate.perHour)}/hr`
        : 'gathering data…';

      let overtakeText = '';
      if (i > 0) {
        const next = rows[i - 1];
        if (row.rate && next.rate) {
          const hours = estimateHoursToOvertake(row.points, next.points, row.rate.perHour, next.rate.perHour);
          overtakeText = `\nOvertake #${rank - 1}: ${formatHours(hours)}`;
        }
      }

      embed.addFields({
        name: `#${rank} ${row.name}`,
        value: `${formatCompact(row.points)} pts (${rateText})${overtakeText}`,
        inline: false,
      });
    });

    if (rows[0]?.icon) {
      const iconUrl = await resolveThumbnail(rows[0].icon, '150x150');
      if (iconUrl) embed.setThumbnail(iconUrl);
    }

    const series = rows.slice(0, 5).map((r) => ({ name: r.name, points: getLeagueSeries(r.key) }));
    const chartUrl = await buildMultiSeriesChartUrl('League Top 5 — Points Over Time', series);
    if (chartUrl) embed.setImage(chartUrl);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`Couldn't fetch league leaderboard: ${err.message}`);
  }
}
