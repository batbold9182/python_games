import pytest

from core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)


def test_password_is_not_stored_in_plaintext():
    h = hash_password("hunter2")
    assert h != "hunter2"
    assert h.startswith("$2b$")  # bcrypt hash format


def test_verify_password_accepts_correct_and_rejects_wrong():
    h = hash_password("hunter2")
    assert verify_password("hunter2", h) is True
    assert verify_password("wrong", h) is False


def test_same_password_hashes_differently_each_time():
    # bcrypt salts each hash, so two hashes of the same password never match
    assert hash_password("hunter2") != hash_password("hunter2")


def test_access_token_roundtrips():
    token = create_access_token(1)
    payload = decode_access_token(token)
    assert payload["sub"] == "1"
    assert payload["type"] == "access"


def test_decode_rejects_garbage_token():
    with pytest.raises(Exception, match="Invalid token"):
        decode_access_token("not.a.real.token")


def test_new_refresh_token_returns_raw_hash_and_expiry():
    raw, token_hash, expires_at = new_refresh_token()
    assert raw != token_hash
    assert hash_refresh_token(raw) == token_hash  # same raw token always hashes the same
    assert expires_at.tzinfo is not None  # timezone-aware

