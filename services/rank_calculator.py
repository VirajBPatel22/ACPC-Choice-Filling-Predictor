import logging
from typing import Dict, Optional
import pandas as pd
from models.schemas import RankCalculationResult

logger = logging.getLogger(__name__)


class RankCalculator:
    """
    Service for calculating ACPC merit percentiles and estimated merit ranks
    from raw Board PCM and GUJCET marks or direct percentiles.
    """

    def __init__(
        self,
        pcm_24_path: str = "pcm_24.csv",
        pcm_25_path: str = "pcm_25.csv",
        gujcet_24_path: str = "gujcet_24.csv",
        gujcet_25_path: str = "gujcet_25.csv",
    ):
        self.pcm_24_mapping = self._load_marks_mapping(pcm_24_path)
        self.pcm_25_mapping = self._load_marks_mapping(pcm_25_path)
        self.gujcet_24_mapping = self._load_marks_mapping(gujcet_24_path)
        self.gujcet_25_mapping = self._load_marks_mapping(gujcet_25_path)

    def _load_marks_mapping(self, filepath: str) -> Dict[float, float]:
        """Loads two-column marks-to-percentile mapping CSV."""
        mapping: Dict[float, float] = {}
        try:
            df = pd.read_csv(filepath, header=None)
            for row in df.values:
                for i in range(0, len(row) - 1, 2):
                    try:
                        mark = float(row[i])
                        pr = float(row[i + 1])
                        if pd.notna(mark) and pd.notna(pr):
                            mapping[mark] = pr
                    except (ValueError, TypeError):
                        continue
        except Exception as e:
            logger.warning(f"Could not load marks mapping file '{filepath}': {e}")
        return mapping

    def get_closest_percentile(self, mapping_dict: Dict[float, float], target_mark: float) -> float:
        """Finds the closest recorded percentile for a given mark."""
        if not mapping_dict:
            return 0.0
        closest_mark = min(mapping_dict.keys(), key=lambda k: abs(k - target_mark))
        return mapping_dict[closest_mark]

    def calculate_by_percentile(self, pcm_pr: float, gujcet_pr: float) -> RankCalculationResult:
        """
        Calculates estimated merit rank based on 50% Board PCM PR + 50% GUJCET PR.
        """
        if pcm_pr <= 0 or gujcet_pr <= 0:
            return RankCalculationResult(rank=0, pcm_pr=pcm_pr, gujcet_pr=gujcet_pr, merit_pr=0.0, source="percentile")

        # Clamp between 0 and 100
        pcm_pr = min(100.0, max(0.0, pcm_pr))
        gujcet_pr = min(100.0, max(0.0, gujcet_pr))

        merit_pr = (pcm_pr * 0.5) + (gujcet_pr * 0.5)
        est_rank = max(1, int(round((100.0 - merit_pr) * 400)))

        return RankCalculationResult(
            rank=est_rank,
            pcm_pr=round(pcm_pr, 4),
            gujcet_pr=round(gujcet_pr, 4),
            merit_pr=round(merit_pr, 4),
            source="percentile",
        )

    def calculate_by_marks(self, pcm_mark: float, gujcet_mark: float) -> RankCalculationResult:
        """
        Translates raw marks to percentiles using historical ACPC distributions
        and calculates estimated merit rank.
        """
        pcm_pr_24 = self.get_closest_percentile(self.pcm_24_mapping, pcm_mark)
        pcm_pr_25 = self.get_closest_percentile(self.pcm_25_mapping, pcm_mark)

        if pcm_pr_24 and pcm_pr_25:
            avg_pcm_pr = (pcm_pr_24 + pcm_pr_25) / 2.0
        else:
            avg_pcm_pr = pcm_pr_24 or pcm_pr_25 or 0.0

        gujcet_pr_24 = self.get_closest_percentile(self.gujcet_24_mapping, gujcet_mark)
        gujcet_pr_25 = self.get_closest_percentile(self.gujcet_25_mapping, gujcet_mark)

        if gujcet_pr_24 and gujcet_pr_25:
            avg_gujcet_pr = (gujcet_pr_24 + gujcet_pr_25) / 2.0
        else:
            avg_gujcet_pr = gujcet_pr_24 or gujcet_pr_25 or 0.0

        if avg_pcm_pr > 0 and avg_gujcet_pr > 0:
            merit_pr = (avg_pcm_pr * 0.5) + (avg_gujcet_pr * 0.5)
            est_rank = max(1, int(round((100.0 - merit_pr) * 400)))
            return RankCalculationResult(
                rank=est_rank,
                pcm_pr=round(avg_pcm_pr, 4),
                gujcet_pr=round(avg_gujcet_pr, 4),
                merit_pr=round(merit_pr, 4),
                source="marks",
            )

        return RankCalculationResult(rank=0, pcm_pr=0.0, gujcet_pr=0.0, merit_pr=0.0, source="marks")
