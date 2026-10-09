"""Shared pytest set-up."""
import os
from pathlib import Path

# the node processes started by the tests get I18N (Italian catalog) before the page scripts
os.environ["NODE_OPTIONS"] = (os.environ.get("NODE_OPTIONS", "") + f" --require={Path(__file__).with_name('node_i18n.js')}").strip()
