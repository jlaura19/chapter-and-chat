import os
import tempfile

# Settings are read once when the app is imported, so the test environment must be set first.
_TMP = tempfile.mkdtemp(prefix="bookclub-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(_TMP, "test.db").replace("\\", "/")
os.environ["UPLOAD_DIR"] = os.path.join(_TMP, "uploads")
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 48
