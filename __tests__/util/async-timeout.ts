const asyncTimeout = async (period: number) => {
    return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), period)
    });
}

export default asyncTimeout;