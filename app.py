import os
import logging
from typing import Dict, Any
from flask import Flask, request, jsonify, render_template, Response
from flask.views import MethodView

from models.schemas import PredictionFilter
from services.data_engine import ACPCDataEngine
from services.rank_calculator import RankCalculator
from services.predictor import CollegePredictor

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("acpc_app")


def create_app() -> Flask:
    """Application factory for ACPC Choice Filling Predictor."""
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "acpc-predictor-secret-key-2025")
    app.config["JSON_SORT_KEYS"] = False

    # Initialize Singleton Data Engine & Services
    data_engine = ACPCDataEngine.get_instance()
    rank_calculator = RankCalculator()
    predictor = CollegePredictor(data_engine)

    # -------------------------------------------------------------
    # Class-Based Views (MethodViews)
    # -------------------------------------------------------------

    class HomeView(MethodView):
        """Renders the main choice filling predictor dashboard."""

        def get(self) -> str:
            filter_options = data_engine.get_filter_options()
            stats = data_engine.stats.to_dict() if data_engine.stats else {}
            return render_template(
                "index.html",
                boards=filter_options.get("boards", []),
                inst_types=filter_options.get("inst_types", []),
                branches=filter_options.get("branches", []),
                institutes=filter_options.get("institutes", []),
                stats=stats,
            )

    class PredictAPI(MethodView):
        """API endpoint for calculating eligible colleges & probabilities."""

        def post(self) -> Response:
            try:
                payload = request.get_json(silent=True) or {}
                filters = PredictionFilter.from_dict(payload)
                colleges = predictor.predict(filters)
                return jsonify({
                    "success": True,
                    "count": len(colleges),
                    "student_rank": filters.rank,
                    "data": colleges,
                })
            except Exception as e:
                logger.error(f"Error executing prediction query: {e}", exc_info=True)
                return jsonify({"success": False, "error": str(e), "data": []}), 500

    class RankCalculatorAPI(MethodView):
        """API endpoint for calculating merit percentile and estimated rank."""

        def post(self) -> Response:
            try:
                payload = request.get_json(silent=True) or {}
                calc_mode = payload.get("mode", "marks")

                if calc_mode == "percentile":
                    pcm_pr = float(payload.get("pcm_pr", 0) or 0)
                    gujcet_pr = float(payload.get("gujcet_pr", 0) or 0)
                    result = rank_calculator.calculate_by_percentile(pcm_pr, gujcet_pr)
                else:
                    pcm_mark = float(payload.get("pcm", 0) or payload.get("pcm_mark", 0) or 0)
                    gujcet_mark = float(payload.get("gujcet", 0) or payload.get("gujcet_mark", 0) or 0)
                    result = rank_calculator.calculate_by_marks(pcm_mark, gujcet_mark)

                return jsonify({
                    "success": True,
                    "rank": result.rank,
                    "pcm_pr": result.pcm_pr,
                    "gujcet_pr": result.gujcet_pr,
                    "merit_pr": result.merit_pr,
                    "source": result.source,
                })
            except Exception as e:
                logger.error(f"Error in rank calculator: {e}", exc_info=True)
                return jsonify({"success": False, "error": str(e), "rank": 0}), 500

    class CollegeDetailsAPI(MethodView):
        """API endpoint for fetching category-wise cutoffs for a college branch."""

        def post(self) -> Response:
            try:
                payload = request.get_json(silent=True) or {}
                inst_name = str(payload.get("inst_name", "")).strip()
                course_name = str(payload.get("course_name", "")).strip()

                if not inst_name or not course_name:
                    return jsonify({"success": False, "error": "Institute and Course name required", "data": []}), 400

                records = data_engine.get_college_details(inst_name, course_name)
                return jsonify({
                    "success": True,
                    "inst_name": inst_name,
                    "course_name": course_name,
                    "count": len(records),
                    "data": records,
                })
            except Exception as e:
                logger.error(f"Error fetching college details: {e}", exc_info=True)
                return jsonify({"success": False, "error": str(e), "data": []}), 500

    class PlatformStatsAPI(MethodView):
        """API endpoint for platform database statistics."""

        def get(self) -> Response:
            stats = data_engine.stats.to_dict() if data_engine.stats else {}
            return jsonify({"success": True, "stats": stats})

    # -------------------------------------------------------------
    # Route Registrations (Class-Based)
    # -------------------------------------------------------------
    app.add_url_rule("/", view_func=HomeView.as_view("home_view"))
    app.add_url_rule("/predict", view_func=PredictAPI.as_view("predict_api"))
    app.add_url_rule("/api/predict", view_func=PredictAPI.as_view("api_predict"))
    app.add_url_rule("/calculate_rank", view_func=RankCalculatorAPI.as_view("rank_calculator_api"))
    app.add_url_rule("/api/calculate_rank", view_func=RankCalculatorAPI.as_view("api_rank_calculator"))
    app.add_url_rule("/api/college_details", view_func=CollegeDetailsAPI.as_view("college_details_api"))
    app.add_url_rule("/api/stats", view_func=PlatformStatsAPI.as_view("platform_stats_api"))

    # Global Error Handlers
    @app.errorhandler(404)
    def not_found_handler(e):
        if request.path.startswith("/api/"):
            return jsonify({"success": False, "error": "Endpoint not found"}), 404
        return render_template("index.html"), 404

    @app.errorhandler(500)
    def server_error_handler(e):
        return jsonify({"success": False, "error": "Internal server error"}), 500

    return app


# Root application instance for WSGI servers (Gunicorn / Render)
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
