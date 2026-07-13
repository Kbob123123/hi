import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getClans } from '../ps99Api.js';
import { getClanRate, getClanSeries, estimateHoursToOvertake, formatHours } from '../history.js';
import { formatCompact } from '../format.js';
import { resolveThumbnail } from '../thumbnails.js';
import { buildMultiSeriesChartUrl } from '../charts.js';

export const data = new SlashCommandBuilder()
  .setName('clantop10')
  .setDescription('Top 10 clans by points, with hourly rates and time-to-overtake estimates');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const clans = await getClans({ page: 1, pageSize: 10, sort: 'Points', sortOrder: 'desc' });

    if (!clans || clans.length === 0) {
      await interaction.editReply('No clan data available.');
      return;
    }

    const rows = clans.map((clan) => ({
      name: clan.Name,
      points: clan.Points,
      icon: clan.Icon,
      members: clan.Members,
      memberCapacity: clan.MemberCapacity,
      rate: getClanRate(clan.Name),
    }));

    const embed = new EmbedBuilder()
      .setTitle('🏆 Clan Top 10')
      .setColor(0xf1c40f)
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
        const next = rows[i - 1]; // the clan ranked just above this one
        if (row.rate && next.rate) {
          const hours = estimateHoursToOvertake(row.points, next.points, row.rate.perHour, next.rate.perHour);
          overtakeText = `\nOvertake #${rank - 1}: ${formatHours(hours)}`;
        }
      }

      embed.addFields({
        name: `#${rank} ${row.name}`,
        value: `${formatCompact(row.points)} pts (${rateText}) · ${row.members ?? '?'}/${row.memberCapacity ?? '?'} members${overtakeText}`,
        inline: false,
      });
    });

    // Thumbnail: #1 clan's icon, if resolvable
    if (rows[0]?.icon) {
      const iconUrl = await resolveThumbnail(rows[0].icon, '150x150');
      if (iconUrl) embed.setThumbnail(iconUrl);
    }

    // Chart: points over time for the top clans that have enough history
    // (clan history stores {time, points}; the chart builder expects {time, value})
    const series = rows
      .slice(0, 5)
      .map((r) => ({ name: r.name, points: getClanSeries(r.name).map((p) => ({ time: p.time, value: p.points })) }));
    const chartUrl = await buildMultiSeriesChartUrl('Clan Top 5 — Points Over Time', series);
    if (chartUrl) {
      embed.setImage(chartUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`Couldn't fetch clan leaderboard: ${err.message}`);
  }
}
