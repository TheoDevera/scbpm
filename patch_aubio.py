import os

for root, dirs, files in os.walk('/tmp/aubio-0.4.9/python'):
    for filename in files:
        if not filename.endswith(('.c', '.h')):
            continue
        path = os.path.join(root, filename)
        with open(path) as f:
            content = f.read()
        patched = content
        patched = patched.replace('npy_intp *dimensions', 'const npy_intp *dimensions')
        patched = patched.replace('npy_intp * dimensions', 'const npy_intp *dimensions')
        patched = patched.replace('npy_intp *strides', 'const npy_intp *strides')
        patched = patched.replace('npy_intp * strides', 'const npy_intp *strides')
        if patched != content:
            with open(path, 'w') as f:
                f.write(patched)
            print(f'Patched: {path}')
