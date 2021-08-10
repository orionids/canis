import inspect


def position():
    frame = inspect.currentframe().f_back
    return f"{frame.f_code.co_filename}:{frame.f_code.co_name}:{frame.f_lineno}"
