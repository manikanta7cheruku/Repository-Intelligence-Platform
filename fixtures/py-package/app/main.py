import os
import requests
from typing import TYPE_CHECKING
from app import utils
from .models import User
from . import helpers
from app.sub.deep import f
if TYPE_CHECKING:
    from app.types import T

def run(x):
    if x and os.name:
        return User, helpers, f, utils, requests
    return None
